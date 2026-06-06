-- Convert L/S portfolios to per-day snapshots (one row per user per calendar day)

alter table public.portfolios
  add column if not exists snapshot_date date;

update public.portfolios
set snapshot_date = (created_at at time zone 'utc')::date
where snapshot_date is null;

alter table public.portfolios
  alter column snapshot_date set not null,
  alter column snapshot_date set default (current_date);

drop index if exists public.portfolios_user_id_unique;

create unique index if not exists portfolios_user_snapshot_unique
  on public.portfolios (user_id, snapshot_date);

create index if not exists idx_portfolios_user_snapshot_date
  on public.portfolios (user_id, snapshot_date desc);
