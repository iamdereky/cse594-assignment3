create extension if not exists pgcrypto;

create type public.emotion_label as enum ('anger', 'fear', 'joy', 'love', 'sadness', 'surprise');
create type public.tweet_purpose as enum ('task', 'example');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  normalized_username text not null unique,
  public_id text not null unique,
  created_at timestamptz not null default now(),
  constraint users_username_length check (char_length(username) between 3 and 24),
  constraint users_username_format check (username ~ '^[A-Za-z0-9_]+$'),
  constraint users_public_id_format check (public_id ~ '^P-[A-Z2-9]{6}$')
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint sessions_expiry_after_creation check (expires_at > created_at)
);

create table public.tweets (
  id text primary key,
  source_split text not null,
  source_index integer not null,
  text text not null,
  ground_truth public.emotion_label not null,
  purpose public.tweet_purpose not null,
  example_rationale text,
  created_at timestamptz not null default now(),
  unique (source_split, source_index),
  constraint example_rationale_usage check (
    (purpose = 'example' and example_rationale is not null)
    or (purpose = 'task' and example_rationale is null)
  )
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tweet_id text not null references public.tweets(id) on delete restrict,
  position smallint not null,
  selected_label public.emotion_label,
  assigned_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (user_id, tweet_id),
  unique (user_id, position),
  constraint assignments_position check (position between 1 and 5),
  constraint assignments_submission_pair check (
    (selected_label is null and submitted_at is null)
    or (selected_label is not null and submitted_at is not null)
  )
);

create index sessions_active_lookup on public.sessions (token_hash, expires_at);
create index assignments_user_progress on public.assignments (user_id, position);
create index assignments_results on public.assignments (submitted_at desc) where selected_label is not null;
create index tweets_task_pool on public.tweets (purpose) where purpose = 'task';

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.tweets enable row level security;
alter table public.assignments enable row level security;

-- All application access uses the server-only service role. No browser-facing
-- policies are created, so the anon and authenticated roles cannot read tables.

create or replace function public.start_assignments(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
begin
  perform 1 from public.users where id = p_user_id for update;
  if not found then
    raise exception 'participant not found';
  end if;

  select count(*) into existing_count
  from public.assignments
  where user_id = p_user_id;

  if existing_count > 0 then
    return existing_count;
  end if;

  insert into public.assignments (user_id, tweet_id, position)
  select p_user_id, selected.id, row_number() over (order by selected.sort_key)::smallint
  from (
    select id, random() as sort_key
    from public.tweets
    where purpose = 'task'
    order by sort_key
    limit 5
  ) as selected;

  get diagnostics existing_count = row_count;
  if existing_count <> 5 then
    raise exception 'task pool must contain at least five tweets';
  end if;
  return existing_count;
end;
$$;

create or replace function public.submit_assignment_label(
  p_user_id uuid,
  p_assignment_id uuid,
  p_label text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_position smallint;
  next_position smallint;
begin
  if p_label not in ('anger', 'fear', 'joy', 'love', 'sadness', 'surprise') then
    raise exception 'invalid emotion label';
  end if;

  select position into target_position
  from public.assignments
  where id = p_assignment_id
    and user_id = p_user_id
    and selected_label is null
  for update;

  if target_position is null then
    return false;
  end if;

  select min(position) into next_position
  from public.assignments
  where user_id = p_user_id and selected_label is null;

  if target_position <> next_position then
    return false;
  end if;

  update public.assignments
  set selected_label = p_label::public.emotion_label,
      submitted_at = now()
  where id = p_assignment_id
    and user_id = p_user_id
    and selected_label is null;

  return found;
end;
$$;

revoke all on function public.start_assignments(uuid) from public, anon, authenticated;
revoke all on function public.submit_assignment_label(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.start_assignments(uuid) to service_role;
grant execute on function public.submit_assignment_label(uuid, uuid, text) to service_role;

grant usage on schema public to service_role;
grant select, insert, delete on table public.users to service_role;
grant select, insert, delete on table public.sessions to service_role;
grant select on table public.tweets to service_role;
grant select on table public.assignments to service_role;

comment on table public.tweets is 'Curated subset of dair-ai/emotion for educational and research use.';
comment on column public.tweets.source_index is 'Zero-based row index in the source Hugging Face train split.';
