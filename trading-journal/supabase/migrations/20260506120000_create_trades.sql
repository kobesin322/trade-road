-- TradeRoad: trading journal trades
-- Requires Supabase Auth (auth.users).

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pair text not null,
  date timestamptz not null,
  outcome text not null,
  profit_percent numeric not null,
  profit_amount numeric not null,
  strategy text not null,
  position text,
  notes text,
  chart_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trades_outcome_check check (outcome in ('WIN', 'LOSS'))
);

create index if not exists trades_user_id_date_idx on public.trades (user_id, date desc);
create index if not exists trades_pair_idx on public.trades (pair);
create index if not exists trades_strategy_idx on public.trades (strategy);

create or replace function public.set_trades_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trades_set_updated_at on public.trades;
create trigger trades_set_updated_at
before update on public.trades
for each row
execute function public.set_trades_updated_at();

alter table public.trades enable row level security;

create policy "Users can select own trades"
on public.trades
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own trades"
on public.trades
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own trades"
on public.trades
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own trades"
on public.trades
for delete
to authenticated
using (auth.uid() = user_id);

-- Realtime (respects RLS for authenticated clients)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trades'
  ) then
    alter publication supabase_realtime add table public.trades;
  end if;
end $$;
