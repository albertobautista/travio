-- Extra permissions the owner grants to viewers (trip_members.permissions):
-- with "saved_places" or "expenses" a viewer adds those, and changes or
-- deletes only the ones they added. Run: npm run test:db
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

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

-- The owner, a viewer who will get permissions and one who won't.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-a000-000000000001', 'owner@test.dev', '{"full_name":"Olga"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000002', 'ximena@test.dev', '{"full_name":"Ximena"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-a000-000000000003', 'vito@test.dev', '{"full_name":"Vito"}', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-a000-000000000001');
insert into public.trips (id, name) values ('00000000-0000-4000-b000-000000000001', 'Viaje de prueba');
select pg_temp.logout();

insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'viewer'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000003', 'viewer');
insert into public.travelers (id, trip_id, name) values
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000001', 'Ximena');
-- Things the owner added.
insert into public.saved_places (id, trip_id, name, created_by) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', 'Café del dueño',
   '00000000-0000-4000-a000-000000000001');
insert into public.expenses (id, trip_id, description, amount, currency, spent_on, created_by) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-b000-000000000001', 'Cena', 100, 'MXN', '2026-10-03',
   '00000000-0000-4000-a000-000000000001');

-- Without permissions a viewer still adds nothing.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select throws_ok($$ insert into public.saved_places (trip_id, name) values ('00000000-0000-4000-b000-000000000001', 'Mirador') $$,
  '42501', null, 'a viewer without the permission cannot save places');
select is(public.my_trip_permissions('00000000-0000-4000-b000-000000000001'), '{}'::text[], 'a viewer starts with no permissions');
-- ...and can't grant them to themselves.
select is_empty($$ update public.trip_members set permissions = '{saved_places}'
  where user_id = '00000000-0000-4000-a000-000000000002' returning user_id $$,
  'a viewer cannot grant themselves permissions');
select pg_temp.logout();

-- The owner grants them.
select pg_temp.login('00000000-0000-4000-a000-000000000001');
select isnt_empty($$ update public.trip_members set permissions = '{saved_places,expenses}'
  where trip_id = '00000000-0000-4000-b000-000000000001' and user_id = '00000000-0000-4000-a000-000000000002' returning user_id $$,
  'the owner grants permissions to a viewer');
select throws_ok($$ update public.trip_members set permissions = '{activities}'
  where user_id = '00000000-0000-4000-a000-000000000003' $$,
  '23514', null, 'only known permissions can be granted');
select pg_temp.logout();

-- Saved places: add, change and delete your own; nobody else's.
select pg_temp.login('00000000-0000-4000-a000-000000000002');
select is(public.my_trip_permissions('00000000-0000-4000-b000-000000000001'), '{saved_places,expenses}'::text[],
  'the viewer sees their permissions');
select lives_ok($$ insert into public.saved_places (id, trip_id, name)
  values ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', 'Mirador') $$,
  'with the permission a viewer saves a place');
select throws_ok($$ insert into public.saved_places (trip_id, name, created_by)
  values ('00000000-0000-4000-b000-000000000001', 'Ajeno', '00000000-0000-4000-a000-000000000001') $$,
  '42501', null, 'a viewer cannot save a place in someone else''s name');
select isnt_empty($$ update public.saved_places set name = 'Mirador alto' where id = '00000000-0000-4000-c000-000000000002' returning id $$,
  'a viewer edits a place they saved');
select is_empty($$ update public.saved_places set name = 'x' where id = '00000000-0000-4000-c000-000000000001' returning id $$,
  'a viewer cannot edit a place someone else saved');
select is_empty($$ delete from public.saved_places where id = '00000000-0000-4000-c000-000000000001' returning id $$,
  'a viewer cannot delete a place someone else saved');
select throws_ok($$ update public.saved_places set created_by = '00000000-0000-4000-a000-000000000001'
  where id = '00000000-0000-4000-c000-000000000002' $$,
  '42501', null, 'a viewer cannot hand their place to someone else');

-- Expenses and their split, the same way.
select lives_ok($$ insert into public.expenses (id, trip_id, description, amount, currency, spent_on)
  values ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-b000-000000000001', 'Taxi', 100, 'MXN', '2026-10-03') $$,
  'with the permission a viewer adds an expense');
select lives_ok($$ select public.set_expense_shares('00000000-0000-4000-d000-000000000002', 'amount',
  jsonb_build_array(
    jsonb_build_object('traveler_id', '00000000-0000-4000-e000-000000000002', 'share', 60),
    jsonb_build_object('traveler_id', (select id from public.travelers where user_id = '00000000-0000-4000-a000-000000000001'), 'share', 40))) $$,
  'a viewer splits an expense they added');
select is((select count(*)::int from public.expense_shares where expense_id = '00000000-0000-4000-d000-000000000002'), 2,
  'the split is saved');
select throws_ok($$ select public.set_expense_shares('00000000-0000-4000-d000-000000000001', 'equal', '[]'::jsonb) $$,
  'P0002', null, 'a viewer cannot re-split someone else''s expense');
select is_empty($$ delete from public.expenses where id = '00000000-0000-4000-d000-000000000001' returning id $$,
  'a viewer cannot delete someone else''s expense');
select isnt_empty($$ delete from public.saved_places where id = '00000000-0000-4000-c000-000000000002' returning id $$,
  'a viewer deletes a place they saved');
-- Other content stays read-only.
select throws_ok($$ insert into public.activities (trip_id, title, starts_at, duration_minutes, timezone)
  values ('00000000-0000-4000-b000-000000000001', 'Colado', now(), 30, 'Europe/Madrid') $$,
  '42501', null, 'the permissions don''t open the itinerary');
select pg_temp.logout();

-- The other viewer got nothing.
select pg_temp.login('00000000-0000-4000-a000-000000000003');
select throws_ok($$ insert into public.expenses (trip_id, description, amount, currency, spent_on)
  values ('00000000-0000-4000-b000-000000000001', 'Helado', 5, 'MXN', '2026-10-03') $$,
  '42501', null, 'permissions are per person');
select pg_temp.logout();

select * from finish();
rollback;
