-- TradeRoad: optional SL / TP / RR on trades + TP/SL push history

alter table public.trades
  add column if not exists stop_loss numeric,
  add column if not exists take_profit numeric,
  add column if not exists risk_reward_ratio numeric;

create table if not exists public.trade_level_pushes (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  level_type text not null,
  price numeric not null,
  pushed_at timestamptz not null default now(),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_level_pushes_level_type_check check (level_type in ('SL', 'TP'))
);

create index if not exists trade_level_pushes_trade_sort_idx
  on public.trade_level_pushes (trade_id, sort_order, pushed_at);

create or replace function public.set_trade_level_pushes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trade_level_pushes_set_updated_at on public.trade_level_pushes;
create trigger trade_level_pushes_set_updated_at
before update on public.trade_level_pushes
for each row
execute function public.set_trade_level_pushes_updated_at();

alter table public.trade_level_pushes enable row level security;

create policy "Users can select own trade level pushes"
on public.trade_level_pushes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own trade level pushes"
on public.trade_level_pushes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own trade level pushes"
on public.trade_level_pushes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own trade level pushes"
on public.trade_level_pushes
for delete
to authenticated
using (auth.uid() = user_id);
