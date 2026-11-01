-- Ordering the route: new destinations go before the return connection, and
-- reorder_trip_stops sets the whole order (drag and drop). Run: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
-- The route as names, in position order (origin included).
create function pg_temp.route(p_trip uuid) returns text language sql as $$
  select string_agg(name, ' > ' order by position) from public.trip_stops where trip_id = p_trip
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'ximena@test.dev', '{"full_name":"Ximena"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name) values
  ('00000000-0000-4000-b000-000000000001', 'Europa'),
  ('00000000-0000-4000-b000-000000000002', 'Solo la ida');

-- Guadalajara (home) -> CDMX (connection) -> Londres -> CDMX (connection back).
insert into public.trip_stops (id, trip_id, name, timezone, kind) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Guadalajara', 'America/Mexico_City', 'origin');
insert into public.trip_stops (id, trip_id, name, timezone, kind) values
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', 'CDMX ida', 'America/Mexico_City', 'transit');
insert into public.trip_stops (id, trip_id, name, timezone) values
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000001', 'Londres', 'Europe/London');
insert into public.trip_stops (id, trip_id, name, timezone, kind) values
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-b000-000000000001', 'CDMX regreso', 'America/Mexico_City', 'transit');

-- A new city, no dates: before the way back, not after it.
insert into public.trip_stops (id, trip_id, name, timezone) values
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-b000-000000000001', 'Viena', 'Europe/Vienna');
select is(pg_temp.route('00000000-0000-4000-b000-000000000001'),
  'Guadalajara > CDMX ida > Londres > Viena > CDMX regreso',
  'a new destination goes before the return connection');

-- Another one still lands just before it.
insert into public.trip_stops (id, trip_id, name, timezone) values
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000001', 'Budapest', 'Europe/Budapest');
select is(pg_temp.route('00000000-0000-4000-b000-000000000001'),
  'Guadalajara > CDMX ida > Londres > Viena > Budapest > CDMX regreso',
  'and the next one too');

-- A new connection goes last: it may well be another leg of the way home.
insert into public.trip_stops (id, trip_id, name, timezone, kind) values
  ('00000000-0000-4000-c000-000000000007', '00000000-0000-4000-b000-000000000001', 'Madrid', 'Europe/Madrid', 'transit');
select is(pg_temp.route('00000000-0000-4000-b000-000000000001'),
  'Guadalajara > CDMX ida > Londres > Viena > Budapest > CDMX regreso > Madrid',
  'a new connection goes at the end');

-- With no destination yet, the trailing connection is the way out: the city goes after it.
insert into public.trip_stops (trip_id, name, timezone, kind) values
  ('00000000-0000-4000-b000-000000000002', 'Guadalajara', 'America/Mexico_City', 'origin'),
  ('00000000-0000-4000-b000-000000000002', 'CDMX', 'America/Mexico_City', 'transit');
insert into public.trip_stops (trip_id, name, timezone) values
  ('00000000-0000-4000-b000-000000000002', 'Londres', 'Europe/London');
select is(pg_temp.route('00000000-0000-4000-b000-000000000002'), 'Guadalajara > CDMX > Londres',
  'without destinations, connections are the way out');

-- Drag and drop: the whole order at once (origin left out).
select public.reorder_trip_stops('00000000-0000-4000-b000-000000000001', array[
  '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000006', '00000000-0000-4000-c000-000000000003',
  '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000004'
]::uuid[]);
select is(pg_temp.route('00000000-0000-4000-b000-000000000001'),
  'Guadalajara > CDMX ida > Budapest > Londres > Viena > Madrid > CDMX regreso',
  'reorder_trip_stops applies the new order');
select is((select position from public.trip_stops where id = '00000000-0000-4000-c000-000000000001'), 1,
  'the origin keeps its position');

select throws_ok($$ select public.reorder_trip_stops('00000000-0000-4000-b000-000000000001', array[
  '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000006']::uuid[]) $$,
  '22023', null, 'a list missing stops is refused');
select throws_ok($$ select public.reorder_trip_stops('00000000-0000-4000-b000-000000000001', array[
  '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000003',
  '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000004'
]::uuid[]) $$,
  '22023', null, 'a stop twice is refused');
select throws_ok($$ select public.reorder_trip_stops('00000000-0000-4000-b000-000000000001', array[
  '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000006', '00000000-0000-4000-c000-000000000003',
  '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000004'
]::uuid[]) $$,
  '22023', null, 'the origin is not part of the list');

-- A viewer can see the route but not reorder it.
select pg_temp.logout();
insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'viewer');
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select throws_ok($$ select public.reorder_trip_stops('00000000-0000-4000-b000-000000000001', array[
  '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000006',
  '00000000-0000-4000-c000-000000000005', '00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000004'
]::uuid[]) $$,
  'P0002', null, 'viewers cannot reorder');
select pg_temp.logout();
select is(pg_temp.route('00000000-0000-4000-b000-000000000001'),
  'Guadalajara > CDMX ida > Budapest > Londres > Viena > Madrid > CDMX regreso',
  'and the order is unchanged');

select * from finish();
rollback;
