-- TradeRoad: user-defined journal strategies + trade species

alter table public.trades drop constraint if exists trades_strategy_check;

alter table public.trades
  add column if not exists species text;

alter table public.trades drop constraint if exists trades_species_check;
alter table public.trades
  add constraint trades_species_check check (
    species is null
    or species in ('Stocks', 'Perps', 'Futures')
  );

create table if not exists public.user_journal_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_journal_strategies_user_name_unique unique (user_id, name)
);

create index if not exists user_journal_strategies_user_sort_idx
  on public.user_journal_strategies (user_id, sort_order, created_at);

create or replace function public.set_user_journal_strategies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_journal_strategies_set_updated_at on public.user_journal_strategies;
create trigger user_journal_strategies_set_updated_at
before update on public.user_journal_strategies
for each row
execute function public.set_user_journal_strategies_updated_at();

alter table public.user_journal_strategies enable row level security;

create policy "Users can select own journal strategies"
on public.user_journal_strategies
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own journal strategies"
on public.user_journal_strategies
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own journal strategies"
on public.user_journal_strategies
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own journal strategies"
on public.user_journal_strategies
for delete
to authenticated
using (auth.uid() = user_id);
