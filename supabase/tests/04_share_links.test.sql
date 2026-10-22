-- Share links: anyone with /v/<code> sees the preview (cover flag, name,
-- dates, cities) and nothing else; members are told apart; nobody picks or
-- changes a code.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

create temp table codes (name text primary key, code text);
grant all on codes to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'editor@test.dev', '{"full_name":"Eva"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000003', 'ana@test.dev', '{"full_name":"Ana"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name, description, start_date, end_date)
values ('00000000-0000-4000-b000-000000000001', 'Europa 2026', 'Notas privadas', '2026-04-06', '2026-04-20');
insert into public.trip_stops (trip_id, name, timezone) values
  ('00000000-0000-4000-b000-000000000001', 'Londres', 'Europe/London'),
  ('00000000-0000-4000-b000-000000000001', 'Cracovia', 'Europe/Warsaw');
insert into codes select 'trip', share_code from public.trips where id = '00000000-0000-4000-b000-000000000001';
select pg_temp.logout();
insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'editor');

select matches((select code from codes where name = 'trip'), '^[A-Za-z0-9_-]{22}$', 'every trip gets a random share code');

-- Signed out: the preview, and only the preview.
select pg_temp.anon();
select is((select public.get_trip_share_preview((select code from codes where name = 'trip')) ->> 'trip_name'), 'Europa 2026',
  'the preview works signed out');
select is((select public.get_trip_share_preview((select code from codes where name = 'trip')) ->> 'status'), 'preview',
  'signed out is not a member');
select is((select public.get_trip_share_preview((select code from codes where name = 'trip')) -> 'cities'), '["Londres", "Cracovia"]'::jsonb,
  'cities come in route order');
select ok(not (select public.get_trip_share_preview((select code from codes where name = 'trip')) ?| array['description', 'cover_image_path', 'share_code']),
  'no notes, storage paths or codes in the preview');
select is(public.get_trip_share_preview('AAAAAAAAAAAAAAAAAAAAAA'), null, 'an unknown code shows nothing');
select throws_ok($$ select public.trip_preview('00000000-0000-4000-b000-000000000001') $$,
  '42501', null, 'trip_preview is not callable directly');
select pg_temp.logout();

-- Signed in: members are told apart from everyone else.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select is((select public.get_trip_share_preview((select code from codes where name = 'trip')) ->> 'status'), 'member',
  'a member is recognized');
select throws_ok($$ update public.trips set share_code = 'BBBBBBBBBBBBBBBBBBBBBB' where id = '00000000-0000-4000-b000-000000000001' $$,
  '42501', null, 'an editor cannot change the share code');
select pg_temp.logout();

select pg_temp.login('00000000-0000-4000-a000-000000000003');
select is((select public.get_trip_share_preview((select code from codes where name = 'trip')) ->> 'status'), 'preview',
  'someone else only gets the preview');
select pg_temp.logout();

-- The group link carries the same preview.
select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into codes select 'group', public.create_trip_group_link('00000000-0000-4000-b000-000000000001') ->> 'token';
select pg_temp.logout();
select pg_temp.anon();
select is((select public.get_trip_group_link((select code from codes where name = 'group')) -> 'cities'), '["Londres", "Cracovia"]'::jsonb,
  'the group link preview has the cities');
select is((select public.get_trip_group_link((select code from codes where name = 'group')) ->> 'status'), 'valid',
  'the group link still works as before');
select pg_temp.logout();

select * from finish();
rollback;
