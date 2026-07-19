-- TradeRoad: entry point price on journal trade entries

alter table public.trades
  add column if not exists entry_point numeric;
