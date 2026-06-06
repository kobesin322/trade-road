-- TradeRoad: optional screenshots on daily overview sections

alter table public.daily_overviews
  add column if not exists pre_trade_list_screenshots jsonb not null default '[]'::jsonb,
  add column if not exists market_analysis_screenshots jsonb not null default '[]'::jsonb;
