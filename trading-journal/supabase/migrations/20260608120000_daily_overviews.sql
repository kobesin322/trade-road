-- TradeRoad: daily journal overview (one row per user per calendar day)

create table if not exists public.daily_overviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  overview_date date not null,
  trade_performance_html text,
  pre_trade_list_html text,
  market_analysis_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_overviews_user_date_unique unique (user_id, overview_date)
);

create index if not exists daily_overviews_user_date_idx
  on public.daily_overviews (user_id, overview_date desc);

create table if not exists public.daily_overview_trades (
  daily_overview_id uuid not null references public.daily_overviews (id) on delete cascade,
  trade_id uuid not null references public.trades (id) on delete cascade,
  primary key (daily_overview_id, trade_id)
);

create index if not exists daily_overview_trades_trade_id_idx
  on public.daily_overview_trades (trade_id);

create or replace function public.set_daily_overviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_overviews_set_updated_at on public.daily_overviews;
create trigger daily_overviews_set_updated_at
before update on public.daily_overviews
for each row
execute function public.set_daily_overviews_updated_at();

alter table public.daily_overviews enable row level security;
alter table public.daily_overview_trades enable row level security;

create policy "Users can select own daily overviews"
on public.daily_overviews
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own daily overviews"
on public.daily_overviews
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own daily overviews"
on public.daily_overviews
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own daily overviews"
on public.daily_overviews
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own daily overview trade links"
on public.daily_overview_trades
for select
to authenticated
using (
  exists (
    select 1
    from public.daily_overviews overview
    where overview.id = daily_overview_id
      and overview.user_id = auth.uid()
  )
);

create policy "Users can insert own daily overview trade links"
on public.daily_overview_trades
for insert
to authenticated
with check (
  exists (
    select 1
    from public.daily_overviews overview
    where overview.id = daily_overview_id
      and overview.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.trades trade
    where trade.id = trade_id
      and trade.user_id = auth.uid()
  )
);

create policy "Users can delete own daily overview trade links"
on public.daily_overview_trades
for delete
to authenticated
using (
  exists (
    select 1
    from public.daily_overviews overview
    where overview.id = daily_overview_id
      and overview.user_id = auth.uid()
  )
);
