-- Core vs Tactical book classification on positions (backward-compatible default: tactical)

do $$
begin
  create type public.position_book_type as enum ('core', 'tactical');
exception
  when duplicate_object then null;
end $$;

alter table public.positions
  add column if not exists book_type public.position_book_type not null default 'tactical';

create index if not exists idx_positions_book_type on public.positions (book_type);
