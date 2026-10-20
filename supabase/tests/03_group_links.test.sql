-- Group links: only the owner creates them, nobody joins without the owner's
-- approval, and the cap, expiry, replacing and rejecting work.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'email',
    (select email from auth.users where id = p_user))::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Tokens exist in clear only in the function's return value: keep them here.
create temp table tokens (name text primary key, token text);
grant all on tokens to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'editor@test.dev', '{"full_name":"Eva"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000003', 'ana@test.dev', '{"full_name":"Ana López"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000004', 'leo@test.dev', '{"full_name":"Leo"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000005', 'mia@test.dev', '{"full_name":"Mía"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name, start_date, end_date) values ('00000000-0000-4000-b000-000000000001', 'Viaje de prueba', '2026-11-01', '2026-11-05');
insert into public.travelers (id, trip_id, name, color) values ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Leo', 'green');
select pg_temp.logout();
insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'editor');

-- An editor cannot create a group link.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select throws_ok($$ select public.create_trip_group_link('00000000-0000-4000-b000-000000000001') $$,
  '42501', null, 'an editor cannot create a group link');
select pg_temp.logout();

-- The owner creates one for 7 days, at most 2 people.
select pg_temp.login('00000000-0000-4000-a000-000000000001');
select throws_ok($$ select public.create_trip_group_link('00000000-0000-4000-b000-000000000001', 3) $$,
  '22023', null, 'a group link lasts 1, 7 or 30 days');
insert into tokens select 'group', public.create_trip_group_link('00000000-0000-4000-b000-000000000001', 7, 2) ->> 'token';
select pg_temp.logout();

-- Signed out: the preview works, asking to join doesn't.
select pg_temp.anon();
select is((select public.get_trip_group_link((select token from tokens where name = 'group')) ->> 'trip_name'), 'Viaje de prueba',
  'the preview works signed out');
select throws_ok($$ select public.request_to_join_trip((select token from tokens where name = 'group')) $$,
  '42501', null, 'signed out you cannot ask to join');
select pg_temp.logout();

-- Ana asks to join: a request, not a membership.
select pg_temp.login('00000000-0000-4000-a000-000000000003');
select is(public.request_to_join_trip((select token from tokens where name = 'group')) ->> 'status', 'requested', 'Ana asks to join');
select is(public.request_to_join_trip((select token from tokens where name = 'group')) ->> 'status', 'pending',
  'asking twice keeps one request');
select is(public.get_trip_group_link((select token from tokens where name = 'group')) ->> 'status', 'pending',
  'the page tells Ana her request is pending');
select is_empty($$ select 1 from public.trips $$, 'a pending request gives no access to the trip');
select is((select count(*)::int from public.trip_join_requests), 1, 'Ana sees her own request');
select throws_ok($$ select public.decide_join_request((select id from public.trip_join_requests), true) $$,
  '42501', null, 'Ana cannot approve herself');
select pg_temp.logout();

-- Leo and Mía ask too.
select pg_temp.login('00000000-0000-4000-a000-000000000004');
select is(public.request_to_join_trip((select token from tokens where name = 'group')) ->> 'status', 'requested', 'Leo asks to join');
select pg_temp.logout();
select pg_temp.login('00000000-0000-4000-a000-000000000005');
select is(public.request_to_join_trip((select token from tokens where name = 'group')) ->> 'status', 'requested', 'Mía asks to join');
select is((select count(*)::int from public.trip_join_requests), 1, 'nobody sees other people''s requests');
select pg_temp.logout();

-- The editor can't see or decide requests.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select is_empty($$ select 1 from public.trip_join_requests $$, 'an editor cannot see join requests');
select throws_ok(
  $$ select public.decide_join_request((select id from public.trip_join_requests where user_id = '00000000-0000-4000-a000-000000000003'), true) $$,
  '42501', null, 'an editor cannot approve requests');
select pg_temp.logout();

-- The owner approves Ana as a new traveler, and Leo as the existing traveler "Leo".
select pg_temp.login('00000000-0000-4000-a000-000000000001');
select is((select count(*)::int from public.trip_join_requests where status = 'pending'), 3, 'the owner sees every request');
select is(public.decide_join_request(
  (select id from public.trip_join_requests where user_id = '00000000-0000-4000-a000-000000000003'), true, 'viewer', null, true) ->> 'status',
  'approved', 'the owner approves Ana');
select is(public.decide_join_request(
  (select id from public.trip_join_requests where user_id = '00000000-0000-4000-a000-000000000004'), true, 'editor',
  '00000000-0000-4000-c000-000000000001') ->> 'status',
  'approved', 'the owner approves Leo as an existing traveler');
-- The cap was 2: Mía no longer fits.
select is(public.decide_join_request(
  (select id from public.trip_join_requests where user_id = '00000000-0000-4000-a000-000000000005'), true) ->> 'status',
  'full', 'the cap stops a third approval');
select is(public.decide_join_request(
  (select id from public.trip_join_requests where user_id = '00000000-0000-4000-a000-000000000005'), false) ->> 'status',
  'rejected', 'the owner rejects Mía');
select pg_temp.logout();

select results_eq(
  $$ select tm.role, tr.name from public.trip_members tm
     left join public.travelers tr on tr.trip_id = tm.trip_id and tr.user_id = tm.user_id
     where tm.user_id in ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004')
     order by tm.user_id $$,
  $$ values ('viewer', 'Ana López'), ('editor', 'Leo') $$,
  'approved people join with the chosen access and traveler');
select is_empty($$ select 1 from public.trip_members where user_id = '00000000-0000-4000-a000-000000000005' $$,
  'a rejected person does not join');

-- Mía can't ask again on the same link, but can on a new one.
select pg_temp.login('00000000-0000-4000-a000-000000000005');
select is(public.request_to_join_trip((select token from tokens where name = 'group')) ->> 'status', 'rejected',
  'a "no" stands for that link');
select pg_temp.logout();
select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into tokens select 'new', public.create_trip_group_link('00000000-0000-4000-b000-000000000001', 1) ->> 'token';
select pg_temp.logout();
select pg_temp.anon();
select is(public.get_trip_group_link((select token from tokens where name = 'group')), null, 'a replaced link stops working');
select pg_temp.logout();
select pg_temp.login('00000000-0000-4000-a000-000000000005');
select is(public.request_to_join_trip((select token from tokens where name = 'new')) ->> 'status', 'requested',
  'a new link lets her ask again');
select pg_temp.logout();

select * from finish();
rollback;
