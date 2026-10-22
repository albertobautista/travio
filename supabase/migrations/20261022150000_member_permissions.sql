-- Extra permissions per member. Asked by Alberto on 2026-10-22: let people
-- who only follow the trip (viewers) add saved places without making them
-- full editors. Design rationale: docs/data-model.md (Authorization).
--
-- The owner grants them one by one, per person, from the person's access
-- dialog. Each permission means "add these, and change or delete the ones
-- YOU added": a viewer who saves a restaurant can fix its address, but can't
-- touch what the others saved. Owners and editors already do everything, so
-- the permissions only matter for viewers (they stay stored if the person is
-- made editor, and apply again if they go back to viewer).
--
-- The list is fixed on purpose (a check constraint, not a table): each
-- permission needs its own policies, so a new one always comes with a
-- migration anyway.
--   saved_places: Guardados (saved_places)
--   expenses:     Gastos (expenses and their split, expense_shares)

alter table public.trip_members
  add column permissions text[] not null default '{}'
    check (permissions <@ array['saved_places', 'expenses']::text[]);

-- ---------------------------------------------------------------------------
-- has_trip_permission(trip, permission): may the caller add this kind of
-- thing? Owners and editors always; viewers when the owner granted it.
-- security definer for the same reason as trip_role (it reads trip_members
-- from inside other tables' policies); it only reveals the caller's own row.
-- ---------------------------------------------------------------------------
create function public.has_trip_permission(p_trip_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select tm.role in ('owner', 'editor') or p_permission = any (tm.permissions)
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = (select auth.uid())
  ), false)
$$;

-- The caller's own extra permissions in a trip, for the app to decide what to
-- show (RLS still decides). Empty for non-members.
create function public.my_trip_permissions(p_trip_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select tm.permissions
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = (select auth.uid())
  ), '{}')
$$;

revoke execute on function public.has_trip_permission(uuid, text), public.my_trip_permissions(uuid) from public, anon;
grant execute on function public.has_trip_permission(uuid, text), public.my_trip_permissions(uuid) to authenticated;

-- Only the owner changes permissions, and only other people's: that's the
-- existing update policy on trip_members ("owner changes other members'
-- roles"), which covers every column of the row.

-- ---------------------------------------------------------------------------
-- saved_places: editors change everything; with the permission, your own.
-- created_by = auth.uid() on insert stops a viewer from passing someone
-- else's id (and so getting rights over a row that isn't theirs).
-- ---------------------------------------------------------------------------
drop policy "saved_places: editors can add" on public.saved_places;
drop policy "saved_places: editors can update" on public.saved_places;
drop policy "saved_places: editors can delete" on public.saved_places;

create policy "saved_places: editors, or members allowed to, can add"
  on public.saved_places for insert to authenticated
  with check (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'saved_places') and created_by = (select auth.uid()))
  );

create policy "saved_places: editors, or their author if allowed, can update"
  on public.saved_places for update to authenticated
  using (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'saved_places') and created_by = (select auth.uid()))
  )
  with check (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'saved_places') and created_by = (select auth.uid()))
  );

create policy "saved_places: editors, or their author if allowed, can delete"
  on public.saved_places for delete to authenticated
  using (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'saved_places') and created_by = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- expenses (and their split): same rule. set_expense_shares is security
-- invoker, so it follows these policies too: it can only re-split an expense
-- the caller may update.
-- ---------------------------------------------------------------------------
drop policy "expenses: editors can add" on public.expenses;
drop policy "expenses: editors can update" on public.expenses;
drop policy "expenses: editors can delete" on public.expenses;

create policy "expenses: editors, or members allowed to, can add"
  on public.expenses for insert to authenticated
  with check (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'expenses') and created_by = (select auth.uid()))
  );

create policy "expenses: editors, or their author if allowed, can update"
  on public.expenses for update to authenticated
  using (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'expenses') and created_by = (select auth.uid()))
  )
  with check (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'expenses') and created_by = (select auth.uid()))
  );

create policy "expenses: editors, or their author if allowed, can delete"
  on public.expenses for delete to authenticated
  using (
    public.can_edit_trip(trip_id)
    or (public.has_trip_permission(trip_id, 'expenses') and created_by = (select auth.uid()))
  );

-- A share belongs to an expense: whoever may change the expense may change
-- its split.
create function public.can_change_expense(p_expense_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense_id
      and (
        public.can_edit_trip(e.trip_id)
        or (public.has_trip_permission(e.trip_id, 'expenses') and e.created_by = (select auth.uid()))
      )
  )
$$;

revoke execute on function public.can_change_expense(uuid) from public, anon;
grant execute on function public.can_change_expense(uuid) to authenticated;

drop policy "expense_shares: editors can add" on public.expense_shares;
drop policy "expense_shares: editors can delete" on public.expense_shares;

create policy "expense_shares: whoever may change the expense can add"
  on public.expense_shares for insert to authenticated
  with check (public.can_change_expense(expense_id));

create policy "expense_shares: whoever may change the expense can delete"
  on public.expense_shares for delete to authenticated
  using (public.can_change_expense(expense_id));
