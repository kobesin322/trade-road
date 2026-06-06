-- TradeRoad: journal fields on trades (rich text + screenshots)

alter table public.trades
  add column if not exists journal_html text,
  add column if not exists screenshots jsonb not null default '[]'::jsonb;

update public.trades
set strategy = case strategy
  when 'Strategy #1' then 'BouncyBall Breakout'
  when 'Strategy #2' then 'Backside trade'
  when 'Strategy #3' then 'Support zone rebounce'
  else strategy
end
where strategy in ('Strategy #1', 'Strategy #2', 'Strategy #3');

alter table public.trades drop constraint if exists trades_strategy_check;

alter table public.trades
  add constraint trades_strategy_check check (
    strategy in (
      'BouncyBall Breakout',
      'Backside trade',
      'Support zone rebounce',
      'Capitulation V'
    )
  );
