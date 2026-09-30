-- Splitting expenses between travelers, and settling up. Decided with Alberto
-- on 2026-10-01: three ways to split (equal, exact amounts, percentages),
-- balances with the fewest payments to settle, and recorded payments.
-- Only actual expenses are split; planned costs aren't.

-- ---------------------------------------------------------------------------
-- How an expense is split.
--   equal:   equal parts among its shares' travelers (no rows = everyone).
--   amount:  each share is an amount in the expense's currency; they add up
--            to the expense's amount.
--   percent: each share is a percentage; they add up to 100.
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column split_mode text not null default 'equal'
    check (split_mode in ('equal', 'amount', 'percent'));

-- expense_shares' composite foreign key needs this (the primary key is id alone).
alter table public.expenses add constraint expenses_trip_id_id_key unique (trip_id, id);

-- ---------------------------------------------------------------------------
-- expense_shares: who takes part in an expense, and with what share.
--
-- NO ROWS FOR AN EXPENSE MEANS "EVERYONE, IN EQUAL PARTS" (like
-- activity_participants), so existing expenses and new travelers just work.
-- `share` is null for equal splits, else the amount or percentage.
-- trip_id is repeated so both foreign keys can be composite (same trip).
-- ---------------------------------------------------------------------------
create table public.expense_shares (
  trip_id uuid not null,
  expense_id uuid not null,
  traveler_id uuid not null,
  share numeric(12, 2) check (share > 0),
  created_at timestamptz not null default now(),
  primary key (expense_id, traveler_id),
  foreign key (trip_id, expense_id) references public.expenses (trip_id, id) on delete cascade,
  foreign key (trip_id, traveler_id) references public.travelers (trip_id, id) on delete cascade
);

create index expense_shares_traveler_idx on public.expense_shares (trip_id, traveler_id);

-- Replaces an expense's split in one transaction and checks it adds up.
-- p_shares: [{"traveler_id": "...", "share": 12.50}, ...]; "share" is ignored
-- for equal splits. An equal split among everyone is stored as no rows.
-- security invoker: `for update` only finds the expense if the caller may edit
-- it (RLS), so viewers get "not found".
create function public.set_expense_shares(p_expense_id uuid, p_mode text, p_shares jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_expense public.expenses;
  v_count integer;
  v_distinct integer;
  v_sum numeric;
  v_trip_travelers integer;
begin
  if p_mode not in ('equal', 'amount', 'percent') then
    raise exception 'Unknown split mode %', p_mode using errcode = '22023';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;

  select count(*), count(distinct (s ->> 'traveler_id')), sum((s ->> 'share')::numeric)
    into v_count, v_distinct, v_sum
    from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) as s;
  if v_count <> v_distinct then
    raise exception 'A traveler appears twice' using errcode = '22023';
  end if;

  if p_mode = 'amount' and (v_count = 0 or v_sum is distinct from v_expense.amount) then
    raise exception 'Shares must add up to the expense amount' using errcode = '22023';
  end if;
  if p_mode = 'percent' and (v_count = 0 or v_sum is distinct from 100) then
    raise exception 'Percentages must add up to 100' using errcode = '22023';
  end if;

  update public.expenses set split_mode = p_mode where id = p_expense_id;
  delete from public.expense_shares where expense_id = p_expense_id;

  if p_mode = 'equal' then
    select count(*) into v_trip_travelers from public.travelers where trip_id = v_expense.trip_id;
    if v_count = 0 or (
      v_count = v_trip_travelers
      and not exists (
        select 1 from jsonb_array_elements(p_shares) as s
        where not exists (
          select 1 from public.travelers t where t.trip_id = v_expense.trip_id and t.id = (s ->> 'traveler_id')::uuid
        )
      )
    ) then
      return; -- everyone
    end if;
  end if;

  -- The composite foreign key rejects travelers from other trips; the check
  -- on `share` rejects zero or negative parts.
  insert into public.expense_shares (trip_id, expense_id, traveler_id, share)
  select v_expense.trip_id, p_expense_id, (s ->> 'traveler_id')::uuid,
         case when p_mode = 'equal' then null else (s ->> 'share')::numeric end
  from jsonb_array_elements(p_shares) as s;
end;
$$;

revoke execute on function public.set_expense_shares(uuid, text, jsonb) from public, anon;
grant execute on function public.set_expense_shares(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- settlements: money one traveler gave another to settle up ("Ximena paid
-- Alberto €300"). Balances subtract them. Recorded, never edited: undoing one
-- deletes it.
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_traveler uuid not null,
  to_traveler uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  paid_on date not null default current_date,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_traveler <> to_traveler),
  foreign key (trip_id, from_traveler) references public.travelers (trip_id, id) on delete cascade,
  foreign key (trip_id, to_traveler) references public.travelers (trip_id, id) on delete cascade
);

create index settlements_trip_idx on public.settlements (trip_id, paid_on);

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write.
-- ---------------------------------------------------------------------------
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;

create policy "expense_shares: members can read"
  on public.expense_shares for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "expense_shares: editors can add"
  on public.expense_shares for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "expense_shares: editors can delete"
  on public.expense_shares for delete to authenticated
  using (public.can_edit_trip(trip_id));

create policy "settlements: members can read"
  on public.settlements for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "settlements: editors can add"
  on public.settlements for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "settlements: editors can delete"
  on public.settlements for delete to authenticated
  using (public.can_edit_trip(trip_id));
