-- L/S Portfolio Schema for Supabase (PostgreSQL)

do $$
begin
  create type public.position_side as enum ('long', 'short');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My L/S Portfolio',
  target_long_ratio numeric(4, 3) not null default 0.700
    check (target_long_ratio between 0 and 1),
  target_short_ratio numeric(4, 3) not null default 0.300
    check (target_short_ratio between 0 and 1),
  long_cash numeric(14, 2) not null default 2500.00,
  short_cash numeric(14, 2) not null default 1400.00,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portfolios_user_id_unique on public.portfolios (user_id);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  side public.position_side not null,
  symbol text not null,
  quantity numeric(12, 4) not null check (quantity >= 0),
  avg_entry_price numeric(12, 4) not null check (avg_entry_price > 0),
  current_price numeric(12, 4) not null check (current_price > 0),
  stop_loss_price numeric(12, 4),
  target_price numeric(12, 4),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_events (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  event_type text not null,
  position_id uuid references public.positions (id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolios_updated_at on public.portfolios;
create trigger portfolios_updated_at
before update on public.portfolios
for each row
execute function public.handle_updated_at();

drop trigger if exists positions_updated_at on public.positions;
create trigger positions_updated_at
before update on public.positions
for each row
execute function public.handle_updated_at();

alter table public.portfolios enable row level security;
alter table public.positions enable row level security;
alter table public.portfolio_events enable row level security;

drop policy if exists "users_own_portfolios" on public.portfolios;
create policy "users_own_portfolios"
on public.portfolios
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users_own_positions" on public.positions;
create policy "users_own_positions"
on public.positions
for all
to authenticated
using (
  exists (
    select 1
    from public.portfolios p
    where p.id = positions.portfolio_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.portfolios p
    where p.id = positions.portfolio_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "users_own_events" on public.portfolio_events;
create policy "users_own_events"
on public.portfolio_events
for all
to authenticated
using (
  exists (
    select 1
    from public.portfolios p
    where p.id = portfolio_events.portfolio_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.portfolios p
    where p.id = portfolio_events.portfolio_id
      and p.user_id = auth.uid()
  )
);

create index if not exists idx_positions_portfolio_id on public.positions (portfolio_id);
create index if not exists idx_events_portfolio_id on public.portfolio_events (portfolio_id);
create index if not exists idx_positions_symbol on public.positions (symbol);
