-- Options: stays and legs saved while comparing. They don't show up in the
-- change summaries until one is chosen. Run: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- trip_events has no policies: count it as the owner of the schema.
create function pg_temp.events(p_entity text) returns text language sql security definer as $$
  select coalesce(string_agg(action, ',' order by id), '') from public.trip_events where entity = p_entity
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name, start_date, end_date) values
  ('00000000-0000-4000-b000-000000000001', 'Europa', '2027-04-06', '2027-04-20');

-- Two hotels for the same nights, being compared.
insert into public.accommodations (id, trip_id, name, check_in_at, check_out_at, timezone, booking_status) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001', 'Hotel A',
   '2027-04-06 15:00+01', '2027-04-09 11:00+01', 'Europe/London', 'option'),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-b000-000000000001', 'Hotel B',
   '2027-04-06 15:00+01', '2027-04-09 11:00+01', 'Europe/London', 'option');
update public.accommodations set name = 'Hotel A (vista al río)' where id = '00000000-0000-4000-d000-000000000001';
delete from public.accommodations where id = '00000000-0000-4000-d000-000000000002';

select is(pg_temp.events('stay'), '', 'adding, editing and deleting options is not news');

update public.accommodations set booking_status = 'booked' where id = '00000000-0000-4000-d000-000000000001';
select is(pg_temp.events('stay'), 'created', 'choosing an option reads as a stay being added');

update public.accommodations set booking_status = 'confirmed' where id = '00000000-0000-4000-d000-000000000001';
select is(pg_temp.events('stay'), 'created', 'a status change alone is still not news');

update public.accommodations set booking_status = 'option' where id = '00000000-0000-4000-d000-000000000001';
select is(pg_temp.events('stay'), 'created,deleted', 'turning it back into an option reads as removed');

select throws_ok($$ update public.accommodations set booking_status = 'maybe' where id = '00000000-0000-4000-d000-000000000001' $$,
  '23514', null, 'stays only take known statuses');

-- Same rules for legs.
insert into public.transportations (id, trip_id, type, origin_name, destination_name,
  departs_at, departs_timezone, arrives_at, arrives_timezone, booking_status) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-b000-000000000001', 'flight', 'Londres', 'Cracovia',
   '2027-04-09 08:10+01', 'Europe/London', '2027-04-09 11:30+02', 'Europe/Warsaw', 'option');
update public.transportations set departs_at = '2027-04-09 09:10+01' where id = '00000000-0000-4000-e000-000000000001';
select is(pg_temp.events('leg'), '', 'options of legs are not news either');

update public.transportations set booking_status = 'planned' where id = '00000000-0000-4000-e000-000000000001';
select is(pg_temp.events('leg'), 'created', 'choosing a leg option reads as added');

select throws_ok($$ update public.transportations set booking_status = 'maybe' where id = '00000000-0000-4000-e000-000000000001' $$,
  '23514', null, 'legs only take known statuses');

-- Viewers see options but can't choose them.
reset role;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000002', 'viewer@test.dev', '{"full_name":"Vera"}', 'authenticated', 'authenticated');
insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'viewer');
update public.accommodations set booking_status = 'option' where id = '00000000-0000-4000-d000-000000000001';
select pg_temp.login('00000000-0000-4000-a000-000000000002');
update public.accommodations set booking_status = 'booked' where id = '00000000-0000-4000-d000-000000000001';
reset role;
select is((select booking_status from public.accommodations where id = '00000000-0000-4000-d000-000000000001'), 'option',
  'a viewer cannot choose an option');

select * from finish();
rollback;
