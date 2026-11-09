-- Assignment 3 is additive; Assignment 1 tables and functions are unchanged.
create table public.meal_trials (
  trial_id text primary key,
  dish_id text not null unique,
  image_path text not null,
  ground_truth_kcal double precision not null check (ground_truth_kcal >= 0 and ground_truth_kcal < 'Infinity'::float8),
  model_total_kcal double precision not null check (model_total_kcal >= 0 and model_total_kcal < 'Infinity'::float8),
  ingredients jsonb not null check (jsonb_typeof(ingredients) = 'array')
);
create table public.calorie_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  condition text not null check (condition in ('no_ai','ai')),
  created_at timestamptz not null default clock_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  attention_initial_pass boolean,
  attention_attempts integer not null default 0,
  attention_passed boolean not null default false,
  num_trials integer not null check (num_trials > 0),
  unique (user_id, condition)
);
create table public.calorie_responses (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.calorie_runs(id),
  trial_id text not null references public.meal_trials(trial_id),
  position integer not null check (position > 0),
  trial_started_at timestamptz,
  ai_consulted_at timestamptz,
  initial_estimate double precision check (initial_estimate >= 0 and initial_estimate < 'Infinity'::float8),
  final_estimate double precision check (final_estimate >= 0 and final_estimate < 'Infinity'::float8),
  confidence smallint check (confidence between 1 and 5),
  trial_ended_at timestamptz,
  duration_ms double precision check (duration_ms >= 0),
  consulted_ai boolean generated always as (ai_consulted_at is not null) stored,
  unique (run_id, trial_id), unique (run_id, position),
  check ((final_estimate is null and confidence is null and trial_ended_at is null and duration_ms is null)
      or (final_estimate is not null and confidence is not null and trial_ended_at is not null and duration_ms is not null and trial_started_at is not null)),
  check (initial_estimate is null or ai_consulted_at is not null),
  check (ai_consulted_at is null or ai_consulted_at >= trial_started_at),
  check (trial_ended_at is null or trial_ended_at >= trial_started_at)
);
create index calorie_response_progress on public.calorie_responses(run_id, position);
alter table public.meal_trials enable row level security;
alter table public.calorie_runs enable row level security;
alter table public.calorie_responses enable row level security;
revoke all on public.meal_trials, public.calorie_runs, public.calorie_responses from anon, authenticated;
grant select on public.meal_trials, public.calorie_runs, public.calorie_responses to service_role;

-- Row locks serialize attention checks, duplicate requests, and multiple tabs.
-- All timestamps are server timestamps. The browser cannot submit consultation history.
create function public.calorie_action(
  p_user_id uuid, p_condition text, p_action text, p_num_trials integer,
  p_response_id uuid default null, p_answer text default null,
  p_estimate double precision default null, p_confidence integer default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  r public.calorie_runs%rowtype;
  t public.calorie_responses%rowtype;
  v_count integer;
  v_now timestamptz;
begin
  if p_condition not in ('ai','no_ai') or p_num_trials < 1 then raise exception 'invalid configuration'; end if;
  perform 1 from public.users where id=p_user_id for update;
  if not found then raise exception 'participant not found'; end if;
  if p_action = 'attention' then
    insert into public.calorie_runs(user_id,condition,num_trials)
    values(p_user_id,p_condition,p_num_trials) on conflict(user_id,condition) do nothing;
  end if;
  select * into r from public.calorie_runs where user_id=p_user_id and condition=p_condition for update;
  if not found then raise exception 'review instructions first'; end if;
  if p_action = 'attention' then
    if r.attention_passed then return; end if;
    if p_answer is null or p_answer not in ('Protein','Price','Calories','Cooking time') then raise exception 'invalid answer'; end if;
    update public.calorie_runs set
      attention_initial_pass=coalesce(attention_initial_pass,p_answer='Calories'),
      attention_attempts=attention_attempts+1, attention_passed=p_answer='Calories'
      where id=r.id;
    if p_answer <> 'Calories' then return; end if;
    -- Exclude meals seen in either condition by this participant.
    insert into public.calorie_responses(run_id,trial_id,position)
    select r.id, selected.trial_id, row_number() over (order by selected.sort_key)
    from (select m.trial_id,random() as sort_key from public.meal_trials m
      where not exists(select 1 from public.calorie_responses cr
        join public.calorie_runs runs on runs.id=cr.run_id
        where runs.user_id=p_user_id and cr.trial_id=m.trial_id)
      order by sort_key limit r.num_trials) selected;
    get diagnostics v_count = row_count;
    if v_count <> r.num_trials then raise exception 'insufficient unseen meals'; end if;
    update public.calorie_runs set started_at=clock_timestamp() where id=r.id;
    return;
  end if;
  if not r.attention_passed then raise exception 'pass the attention check first'; end if;
  select * into t from public.calorie_responses where id=p_response_id and run_id=r.id for update;
  if not found then raise exception 'trial not found'; end if;
  -- A successful submit may be retried after a lost network response.
  if t.final_estimate is not null and p_action='submit' then return; end if;
  if t.final_estimate is not null or t.position <> (select min(position) from public.calorie_responses where run_id=r.id and final_estimate is null)
    then raise exception 'trial is not current'; end if;
  v_now := clock_timestamp();
  if p_action='start' then
    update public.calorie_responses set trial_started_at=coalesce(trial_started_at,v_now) where id=t.id;
    return;
  end if;
  if t.trial_started_at is null then raise exception 'load the meal image first'; end if;
  if p_estimate is not null and (p_estimate < 0 or not (p_estimate < 'Infinity'::float8)) then raise exception 'invalid estimate'; end if;
  if p_action='consult' then
    if p_condition <> 'ai' then raise exception 'assistant unavailable'; end if;
    if t.ai_consulted_at is null then
      update public.calorie_responses set ai_consulted_at=v_now,initial_estimate=p_estimate where id=t.id;
    end if;
  elsif p_action='submit' then
    if p_estimate is null or p_confidence is null or p_confidence not between 1 and 5 then raise exception 'estimate and confidence required'; end if;
    update public.calorie_responses set final_estimate=p_estimate,confidence=p_confidence,
      trial_ended_at=v_now,duration_ms=extract(epoch from (v_now-t.trial_started_at))*1000 where id=t.id;
    if not exists(select 1 from public.calorie_responses where run_id=r.id and final_estimate is null) then
      update public.calorie_runs set completed_at=v_now where id=r.id;
    end if;
  else raise exception 'unknown action'; end if;
end;
$$;
revoke all on function public.calorie_action(uuid,text,text,integer,uuid,text,double precision,integer) from public,anon,authenticated;
grant execute on function public.calorie_action(uuid,text,text,integer,uuid,text,double precision,integer) to service_role;

-- Researcher-only flat export; immutable imported meals retain the reference values.
create view public.calorie_analysis_records with (security_invoker=true) as
select r.user_id, u.public_id as participant_id,r.id as study_session_id,r.condition,
 r.created_at,r.started_at as study_started_at,r.completed_at,r.attention_initial_pass,r.attention_attempts,
 cr.*,m.dish_id,m.ground_truth_kcal,m.model_total_kcal
from public.calorie_responses cr join public.calorie_runs r on r.id=cr.run_id
join public.users u on u.id=r.user_id join public.meal_trials m on m.trial_id=cr.trial_id;
revoke all on public.calorie_analysis_records from anon,authenticated;
grant select on public.calorie_analysis_records to service_role;
