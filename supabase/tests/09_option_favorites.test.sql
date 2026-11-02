-- Favorite options: only an option can carry the star, and it goes away by
-- itself when the option is chosen. Starring isn't news for the others.
-- Run: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- trip_events has no policies: read it as the owner of the schema.
create function pg_temp.events(p_entity text) returns text language sql security definer as $$
  select coalesce(string_agg(action, ',' order by id), '') from public.trip_events where entity = p_entity
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'viewer@test.dev', '{"full_name":"Vera"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name, start_date, end_date) values
  ('00000000-0000-4000-b000-000000000001', 'Europa', '2027-04-06', '2027-04-20');
reset role;
insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'viewer');
select pg_temp.login('00000000-0000-4000-a000-000000000001');

insert into public.accommodations (id, trip_id, name, check_in_at, check_out_at, timezone, booking_status) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001', 'Hotel A',
   '2027-04-06 15:00+01', '2027-04-09 11:00+01', 'Europe/London', 'option'),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-b000-000000000001', 'Hotel B',
   '2027-04-06 15:00+01', '2027-04-09 11:00+01', 'Europe/London', 'planned');

-- Starring the option isn't news (only Hotel B, planned, was added).
select pg_temp.login('00000000-0000-4000-a000-000000000001');
update public.accommodations set favorite = true where id = '00000000-0000-4000-d000-000000000001';
reset role;
select is(pg_temp.events('stay'), 'created', 'starring an option is not news');
select is((select favorite from public.accommodations where id = '00000000-0000-4000-d000-000000000001'), true, 'an option can be the favorite');

-- A stay that isn't an option can't be starred: the trigger drops the star.
select pg_temp.login('00000000-0000-4000-a000-000000000001');
update public.accommodations set favorite = true where id = '00000000-0000-4000-d000-000000000002';
reset role;
select is((select favorite from public.accommodations where id = '00000000-0000-4000-d000-000000000002'), false, 'only options keep the star');

-- Viewers can't star.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
update public.accommodations set favorite = false where id = '00000000-0000-4000-d000-000000000001';
reset role;
select is((select favorite from public.accommodations where id = '00000000-0000-4000-d000-000000000001'), true, 'a viewer cannot change the star');

-- Choosing the favorite clears its star.
select pg_temp.login('00000000-0000-4000-a000-000000000001');
update public.accommodations set booking_status = 'booked' where id = '00000000-0000-4000-d000-000000000001';
reset role;
select is((select favorite from public.accommodations where id = '00000000-0000-4000-d000-000000000001'), false, 'choosing an option clears its star');

select * from finish();
rollback;
