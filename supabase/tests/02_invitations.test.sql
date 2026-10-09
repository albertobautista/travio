-- Invitations: only the owner creates them, the preview reveals little,
-- each link works once, and accepting does what the owner decided.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
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
  ('00000000-0000-4000-a000-000000000004', 'leo@test.dev', '{"full_name":"Leo"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name, start_date, end_date) values ('00000000-0000-4000-b000-000000000001', 'Viaje de prueba', '2026-11-01', '2026-11-05');
select pg_temp.logout();
insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'editor');

-- Owner creates two invitations: someone new who travels, and a follower.
select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into tokens select 'new', public.create_trip_invitation('00000000-0000-4000-b000-000000000001', 'editor', null, true) ->> 'token';
insert into tokens select 'follow', public.create_trip_invitation('00000000-0000-4000-b000-000000000001', 'viewer') ->> 'token';
select pg_temp.logout();

select ok((select token_hash <> convert_to(t.token, 'UTF8') from public.trip_invitations, tokens t where t.name = 'new' limit 1),
  'the database keeps a hash, not the token');

-- An editor cannot invite.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select throws_ok($$ select public.create_trip_invitation('00000000-0000-4000-b000-000000000001', 'viewer') $$,
  '42501', null, 'an editor cannot create invitations');
select is_empty($$ select 1 from public.trip_invitations $$, 'an editor cannot see invitations');
select pg_temp.logout();

-- Signed out: a minimal preview, and no way to accept.
select pg_temp.anon();
select is((select public.get_trip_invitation((select token from tokens where name = 'new')) ->> 'trip_name'), 'Viaje de prueba',
  'the preview works signed out');
select ok((select not (public.get_trip_invitation((select token from tokens where name = 'new')) ? 'unlinked_travelers')),
  'the preview does not list the trip''s people');
select is(public.get_trip_invitation('not-a-real-token'), null, 'an unknown token reveals nothing');
select throws_ok($$ select public.accept_trip_invitation((select token from tokens where name = 'new')) $$,
  '42501', null, 'signed out you cannot accept');
select pg_temp.logout();

-- An existing member opening the link: nothing changes, link stays unused.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select is(public.accept_trip_invitation((select token from tokens where name = 'new')) ->> 'status', 'member',
  'a member who opens a link keeps their role');
select pg_temp.logout();
select is((select role from public.trip_members where user_id = '00000000-0000-4000-a000-000000000002'), 'editor',
  '...and their role is unchanged');

-- Ana accepts "someone new who travels": she joins as editor and as a traveler.
select pg_temp.login('00000000-0000-4000-a000-000000000003');
select is(public.accept_trip_invitation((select token from tokens where name = 'new')) ->> 'status', 'joined', 'Ana joins');
select pg_temp.logout();
select is((select name from public.travelers where user_id = '00000000-0000-4000-a000-000000000003'), 'Ana López',
  'accepting "someone new" adds her as a traveler with her account''s name');

-- The same link a second time: used.
select pg_temp.login('00000000-0000-4000-a000-000000000004');
select is(public.accept_trip_invitation((select token from tokens where name = 'new')) ->> 'status', 'used',
  'a link works only once');
-- The follower link: joins without becoming a traveler.
select is(public.accept_trip_invitation((select token from tokens where name = 'follow')) ->> 'status', 'joined', 'Leo follows the trip');
select pg_temp.logout();

select * from finish();
rollback;
