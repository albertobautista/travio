-- Budget: planned costs (already on activities, stays and legs) vs actual
-- spending (expenses), in the trip's currency. Decided with Alberto on
-- 2026-09-30: estimated + actual, and a per-trip exchange rate the user
-- confirms (suggested from ECB rates), so totals don't move by themselves.
--
-- Budget categories (the six in CLAUDE.md): flights, accommodation,
-- transportation, activities, food, other. Planned costs map to them in the
-- app (src/lib/budget); expenses store one directly.

-- ---------------------------------------------------------------------------
-- Exchange rates: 1 unit of `currency` = `rate` units of the trip's currency.
-- One row per foreign currency used in the trip. The trip's own currency
-- never needs a row (its rate is 1).
-- ---------------------------------------------------------------------------
create table public.trip_exchange_rates (
  trip_id uuid not null references public.trips (id) on delete cascade,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  rate numeric(18, 6) not null check (rate > 0),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, currency)
);

create trigger trip_exchange_rates_set_updated_at
  before update on public.trip_exchange_rates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Expenses: what was actually spent during (or before) the trip.
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  category text not null default 'other'
    check (category in ('flights', 'accommodation', 'transportation', 'activities', 'food', 'other')),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  spent_on date not null,
  -- Who paid. Optional; a traveler of the same trip. Removing the traveler
  -- keeps the expense.
  paid_by uuid,
  notes text check (char_length(notes) <= 1000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_paid_by_same_trip
    foreign key (trip_id, paid_by) references public.travelers (trip_id, id)
    on delete set null (paid_by)
);

create index expenses_trip_spent_on_idx on public.expenses (trip_id, spent_on);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write.
-- ---------------------------------------------------------------------------
alter table public.trip_exchange_rates enable row level security;
alter table public.expenses enable row level security;

create policy "trip_exchange_rates: members can read"
  on public.trip_exchange_rates for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "trip_exchange_rates: editors can add"
  on public.trip_exchange_rates for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "trip_exchange_rates: editors can update"
  on public.trip_exchange_rates for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "trip_exchange_rates: editors can delete"
  on public.trip_exchange_rates for delete to authenticated
  using (public.can_edit_trip(trip_id));

create policy "expenses: members can read"
  on public.expenses for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "expenses: editors can add"
  on public.expenses for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "expenses: editors can update"
  on public.expenses for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "expenses: editors can delete"
  on public.expenses for delete to authenticated
  using (public.can_edit_trip(trip_id));
