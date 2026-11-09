-- The study uses private usernames as lightweight participant identifiers.
-- Existing accounts remain available under the same username.
alter table public.users drop column if exists password_salt;
alter table public.users drop column if exists password_hash;

grant usage on schema public to service_role;
grant select, insert, delete on table public.users to service_role;
grant select, insert, delete on table public.sessions to service_role;
grant select on table public.tweets to service_role;
grant select on table public.assignments to service_role;
