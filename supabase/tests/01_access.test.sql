-- Who can see and change a trip, enforced by RLS. Run: npm run test:db
-- (supabase test db). Everything happens inside a transaction that is rolled
-- back, so it leaves no data behind.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Act as a signed-in user (what the app does with the user's session), or as
-- nobody (signed out).
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Four people: the owner, an editor, a viewer and a stranger.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'editor@test.dev', '{"full_name":"Eva"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000003', 'viewer@test.dev', '{"full_name":"Vito"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000004', 'stranger@test.dev', '{"full_name":"Sam"}', 'authenticated', 'authenticated');

-- Created like the app does it: the creator becomes owner (trigger).
select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name) values ('00000000-0000-4000-b000-000000000001', 'Viaje de prueba');
select pg_temp.logout();

insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'editor'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000003', 'viewer');
insert into public.activities (id, trip_id, title, starts_at, duration_minutes, timezone) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Museo', '2026-10-03 08:00+00', 120, 'Europe/Madrid');
insert into public.files (id, trip_id, storage_path, original_name, mime_type, size_bytes) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001',
   '00000000-0000-4000-b000-000000000001/00000000-0000-4000-d000-000000000001/boleto.pdf', 'boleto.pdf', 'application/pdf', 1024);

select is((select role from public.trip_members where user_id = '00000000-0000-4000-a000-000000000001'), 'owner',
  'creating a trip makes you its owner');

-- A stranger sees nothing of it.
select pg_temp.login('00000000-0000-4000-a000-000000000004');
select is_empty($$ select 1 from public.trips where id = '00000000-0000-4000-b000-000000000001' $$, 'a stranger cannot see the trip');
select is_empty($$ select 1 from public.activities where trip_id = '00000000-0000-4000-b000-000000000001' $$, 'a stranger cannot see its activities');
select is_empty($$ select 1 from public.files where trip_id = '00000000-0000-4000-b000-000000000001' $$, 'a stranger cannot see its documents');
select is_empty($$ select 1 from public.trip_members where trip_id = '00000000-0000-4000-b000-000000000001' $$, 'a stranger cannot see who is in it');
select pg_temp.logout();

-- A viewer sees everything and changes nothing.
select pg_temp.login('00000000-0000-4000-a000-000000000003');
select isnt_empty($$ select 1 from public.files where trip_id = '00000000-0000-4000-b000-000000000001' $$, 'a viewer sees the documents');
select is_empty($$ update public.activities set title = 'x' where id = '00000000-0000-4000-c000-000000000001' returning id $$,
  'a viewer cannot edit an activity');
select throws_ok($$ insert into public.activities (trip_id, title, starts_at, duration_minutes, timezone)
  values ('00000000-0000-4000-b000-000000000001', 'Colado', now(), 30, 'Europe/Madrid') $$,
  '42501', null, 'a viewer cannot add activities');
select pg_temp.logout();

-- An editor edits content but not access.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select isnt_empty($$ update public.activities set title = 'Museo del Prado' where id = '00000000-0000-4000-c000-000000000001' returning id $$,
  'an editor can edit an activity');
select is_empty($$ delete from public.trips where id = '00000000-0000-4000-b000-000000000001' returning id $$,
  'an editor cannot delete the trip');
select throws_ok($$ insert into public.trip_members (trip_id, user_id, role)
  values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'viewer') $$,
  '42501', null, 'an editor cannot give anyone access');
select is_empty($$ update public.trip_members set role = 'editor' where user_id = '00000000-0000-4000-a000-000000000003' returning user_id $$,
  'an editor cannot change roles');
select pg_temp.logout();

-- The owner can't hand out the owner role through the table, nor leave.
select pg_temp.login('00000000-0000-4000-a000-000000000001');
select throws_ok($$ insert into public.trip_members (trip_id, user_id, role)
  values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000004', 'owner') $$,
  '42501', null, 'nobody becomes owner by inserting a row');
select is_empty($$ delete from public.trip_members where user_id = '00000000-0000-4000-a000-000000000001' returning user_id $$,
  'the owner cannot leave without handing the trip over');
-- Change history is for the notification job only.
select is_empty($$ select 1 from public.trip_events $$, 'members cannot read trip_events');
select pg_temp.logout();

-- The editor's change above was recorded, with who did it.
select is((select actor_id from public.trip_events where entity_id = '00000000-0000-4000-c000-000000000001'),
  '00000000-0000-4000-a000-000000000002'::uuid, 'an edit is recorded in trip_events with its author');

select * from finish();
rollback;
