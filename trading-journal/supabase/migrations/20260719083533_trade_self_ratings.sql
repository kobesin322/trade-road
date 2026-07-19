-- TradeRoad: self-rated ranking grades on journal trade entries

alter table public.trades
  add column if not exists rating_overall text,
  add column if not exists rating_sizing text,
  add column if not exists rating_entry text,
  add column if not exists rating_exit text;

alter table public.trades drop constraint if exists trades_rating_overall_check;
alter table public.trades drop constraint if exists trades_rating_sizing_check;
alter table public.trades drop constraint if exists trades_rating_entry_check;
alter table public.trades drop constraint if exists trades_rating_exit_check;

alter table public.trades
  add constraint trades_rating_overall_check check (
    rating_overall is null
    or rating_overall in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D')
  ),
  add constraint trades_rating_sizing_check check (
    rating_sizing is null
    or rating_sizing in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D')
  ),
  add constraint trades_rating_entry_check check (
    rating_entry is null
    or rating_entry in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D')
  ),
  add constraint trades_rating_exit_check check (
    rating_exit is null
    or rating_exit in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D')
  );
