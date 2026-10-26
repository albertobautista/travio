-- Kinds of stop (destination / origin / transit): one origin per trip, the
-- origin has no dates and reordering skips it. Run: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name) values ('00000000-0000-4000-b000-000000000001', 'Europa');

-- Guadalajara -> Mexico City (connection) -> London; positions 1, 2, 3.
insert into public.trip_stops (id, trip_id, name, timezone, kind) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Guadalajara', 'America/Mexico_City', 'origin');
insert into public.trip_stops (id, trip_id, name, timezone, kind, arrives_on, departs_on) values
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', 'Ciudad de México', 'America/Mexico_City', 'transit', '2027-04-06', '2027-04-06');
insert into public.trip_stops (id, trip_id, name, timezone) values
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000001', 'Londres', 'Europe/London');

select is((select kind from public.trip_stops where id = '00000000-0000-4000-c000-000000000003'), 'destination',
  'stops are destinations by default');
select throws_ok($$ insert into public.trip_stops (trip_id, name, timezone, kind)
  values ('00000000-0000-4000-b000-000000000001', 'Zapopan', 'America/Mexico_City', 'origin') $$,
  '23505', null, 'a trip has a single origin');
select throws_ok($$ update public.trip_stops set arrives_on = '2027-04-06' where id = '00000000-0000-4000-c000-000000000001' $$,
  '23514', null, 'the origin has no dates');
select throws_ok($$ update public.trip_stops set kind = 'layover' where id = '00000000-0000-4000-c000-000000000002' $$,
  '23514', null, 'only known kinds are accepted');

-- Moving the stop after the origin up does nothing: the origin isn't swapped.
select public.move_trip_stop('00000000-0000-4000-c000-000000000002', -1);
select is((select position from public.trip_stops where id = '00000000-0000-4000-c000-000000000002'), 2,
  'reordering never swaps with the origin');
select public.move_trip_stop('00000000-0000-4000-c000-000000000001', 1);
select is((select position from public.trip_stops where id = '00000000-0000-4000-c000-000000000001'), 1,
  'the origin itself is not moved');
select public.move_trip_stop('00000000-0000-4000-c000-000000000003', -1);
select is((select position from public.trip_stops where id = '00000000-0000-4000-c000-000000000003'), 2,
  'other stops still swap with each other');

-- Link previews list destinations only (trip_preview is internal: run it as the owner of the schema).
reset role;
select is(public.trip_preview('00000000-0000-4000-b000-000000000001') -> 'cities', '["Londres"]'::jsonb,
  'previews leave out the origin and connections');

select * from finish();
rollback;
