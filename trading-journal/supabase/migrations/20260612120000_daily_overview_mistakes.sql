-- Daily overview: trading mistakes checklist + notes per day

alter table public.daily_overviews
  add column if not exists mistake_flags jsonb not null default '[]'::jsonb,
  add column if not exists mistakes_notes text;
