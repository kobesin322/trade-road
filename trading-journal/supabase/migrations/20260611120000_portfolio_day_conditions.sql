-- Daily trading condition flags + confidence levels per portfolio snapshot

alter table public.portfolios
  add column if not exists flag_overtrading boolean not null default false,
  add column if not exists flag_over_focus boolean not null default false,
  add column if not exists flag_over_position boolean not null default false,
  add column if not exists flag_not_focusing boolean not null default false,
  add column if not exists flag_emotional_trading boolean not null default false,
  add column if not exists market_confidence smallint not null default 50
    check (market_confidence between 0 and 100),
  add column if not exists self_confidence smallint not null default 50
    check (self_confidence between 0 and 100);
