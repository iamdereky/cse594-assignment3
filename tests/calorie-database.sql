-- Run only against a test database with migrations and calorie_seed.sql loaded.
-- This test rolls back all test participants and responses.
begin;
do $$
declare
  uid uuid; other_uid uuid; rid uuid; next_id uuid; item record; mode text;
  first_time timestamptz; start_time timestamptz; n integer;
begin
  insert into users(username,normalized_username,public_id) values('test_a3','test_a3','P-TESTAA') returning id into uid;
  insert into users(username,normalized_username,public_id) values('test_other','test_other','P-TESTAB') returning id into other_uid;
  foreach mode in array array['no_ai','ai'] loop
    perform calorie_action(uid,mode,'attention',10,p_answer=>'Protein');
    if (select attention_initial_pass from calorie_runs where user_id=uid and condition=mode) is distinct from false then raise exception 'initial failure not captured'; end if;
    if exists(select 1 from calorie_responses cr join calorie_runs r on r.id=cr.run_id where r.user_id=uid and r.condition=mode) then raise exception 'assigned before passing'; end if;
    perform calorie_action(uid,mode,'attention',10,p_answer=>'Calories');
    perform calorie_action(uid,mode,'attention',10,p_answer=>'Calories');
    select id into rid from calorie_runs where user_id=uid and condition=mode;
    if (select count(*) from calorie_responses where run_id=rid) <> 10 then raise exception 'wrong sample size'; end if;
    if (select attention_attempts from calorie_runs where id=rid) <> 2 then raise exception 'attention retry failed'; end if;
    select id into next_id from calorie_responses where run_id=rid and position=2;
    begin
      perform calorie_action(uid,mode,'start',10,next_id);
      raise exception 'out of order accepted';
    exception when raise_exception then if sqlerrm='out of order accepted' then raise; end if; end;
    for item in select * from calorie_responses where run_id=rid order by position loop
      begin
        perform calorie_action(other_uid,mode,'start',10,item.id);
        raise exception 'another participant accessed trial';
      exception when raise_exception then if sqlerrm='another participant accessed trial' then raise; end if; end;
      perform calorie_action(uid,mode,'start',10,item.id);
      select trial_started_at into start_time from calorie_responses where id=item.id;
      perform calorie_action(uid,mode,'start',10,item.id);
      if (select trial_started_at from calorie_responses where id=item.id) <> start_time then raise exception 'refresh reset time'; end if;
      if mode='ai' and item.position <= 2 then
        perform calorie_action(uid,mode,'consult',10,item.id,p_estimate=>case when item.position=1 then 600 else null end);
        select ai_consulted_at into first_time from calorie_responses where id=item.id;
        perform calorie_action(uid,mode,'consult',10,item.id,p_estimate=>999);
        if (select ai_consulted_at from calorie_responses where id=item.id) <> first_time then raise exception 'consult timestamp overwritten'; end if;
        if item.position=1 and (select initial_estimate from calorie_responses where id=item.id) <> 600 then raise exception 'initial overwritten'; end if;
        if item.position=2 and (select initial_estimate from calorie_responses where id=item.id) is not null then raise exception 'blank initial overwritten'; end if;
      elsif mode='no_ai' then
        begin
          perform calorie_action(uid,mode,'consult',10,item.id,p_estimate=>600);
          raise exception 'no ai consultation accepted';
        exception when raise_exception then if sqlerrm='no ai consultation accepted' then raise; end if; end;
      end if;
      begin
        perform calorie_action(uid,mode,'submit',10,item.id,p_estimate=>-1,p_confidence=>3);
        raise exception 'negative accepted';
      exception when raise_exception then if sqlerrm='negative accepted' then raise; end if; end;
      begin
        perform calorie_action(uid,mode,'submit',10,item.id,p_estimate=>1,p_confidence=>6);
        raise exception 'bad confidence accepted';
      exception when raise_exception then if sqlerrm='bad confidence accepted' then raise; end if; end;
      perform calorie_action(uid,mode,'submit',10,item.id,p_estimate=>720,p_confidence=>4);
      perform calorie_action(uid,mode,'submit',10,item.id,p_estimate=>999,p_confidence=>1);
      if (select final_estimate from calorie_responses where id=item.id) <> 720 then raise exception 'duplicate overwrite'; end if;
    end loop;
    if (select completed_at from calorie_runs where id=rid) is null then raise exception 'not completed'; end if;
  end loop;
  if (select count(distinct trial_id) from calorie_responses cr join calorie_runs r on r.id=cr.run_id where r.user_id=uid) <> 20 then raise exception 'repeated meal'; end if;
  if (select count(*) from calorie_analysis_records where user_id=uid and final_estimate=720 and confidence=4
      and trial_started_at is not null and trial_ended_at>=trial_started_at and duration_ms>=0
      and dish_id is not null and ground_truth_kcal is not null and model_total_kcal is not null) <> 20 then raise exception 'missing analysis data'; end if;
  if (select count(*) from calorie_analysis_records where user_id=uid and consulted_ai) <> 2 then raise exception 'wrong consultation count'; end if;
  if has_table_privilege('anon','meal_trials','select') or has_function_privilege('anon','calorie_action(uuid,text,text,integer,uuid,text,double precision,integer)','execute') then raise exception 'anonymous access'; end if;
  raise notice 'PASS: both 10-trial flows; attention retry, no repeats, first consult, null initial, duplicate requests, ownership, sequencing, validation, timing, permissions, and analysis fields';
end;
$$;
rollback;
