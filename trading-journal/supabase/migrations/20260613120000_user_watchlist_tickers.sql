-- TradeRoad: per-user saved market watchlist tickers

create table if not exists public.user_watchlist_tickers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  yahoo_symbol text not null,
  label text not null,
  trading_view_symbol text not null,
  asset_class text not null,
  quote_type text,
  exchange text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_watchlist_tickers_asset_class_check
    check (asset_class in ('crypto', 'stock')),
  constraint user_watchlist_tickers_user_symbol_unique unique (user_id, yahoo_symbol)
);

create index if not exists user_watchlist_tickers_user_sort_idx
  on public.user_watchlist_tickers (user_id, sort_order, created_at);

create or replace function public.set_user_watchlist_tickers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_watchlist_tickers_set_updated_at on public.user_watchlist_tickers;
create trigger user_watchlist_tickers_set_updated_at
before update on public.user_watchlist_tickers
for each row
execute function public.set_user_watchlist_tickers_updated_at();

alter table public.user_watchlist_tickers enable row level security;

create policy "Users can select own watchlist tickers"
on public.user_watchlist_tickers
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own watchlist tickers"
on public.user_watchlist_tickers
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own watchlist tickers"
on public.user_watchlist_tickers
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own watchlist tickers"
on public.user_watchlist_tickers
for delete
to authenticated
using (auth.uid() = user_id);
