-- POTENT Beats: the beat-maker royalty (owner decision, Oct 24 2026) + mystery packs.
-- Run ONCE in Supabase > SQL Editor > New query. Safe to run more than once.
--
-- The split for an exclusive sale is now: seller (splits.exclusive, 91-99) / whoever MADE the
-- beat 8% royalty / POTENT platform fee 1%. The 8% used to be recorded as "unallocated" and paid
-- to nobody; it now has a named recipient on every sale.

-- Each beat listing carries a "made by" maker credit (a producer). Existing listings default to
-- their producer of record, which is also the runtime fallback when maker_id is null.
alter table beat_items
  add column if not exists maker_id uuid references beat_producers(id);
update beat_items set maker_id = producer_id where maker_id is null;

-- Each sale snapshots who the maker was and what their royalty came to, so refunds and
-- chargebacks can reverse the royalty from the maker's wallet exactly like the seller's share.
alter table beat_sales
  add column if not exists maker_id uuid references beat_producers(id),
  add column if not exists maker_cents int not null default 0,
  add column if not exists pack_session_id text;   -- set on every row of a mystery-pack sale (one Stripe session, several beats)
create index if not exists beat_sales_pack on beat_sales(pack_session_id);

-- The revenue model sketched in beat-market.sql is now CONFIRMED by the owner:
-- artist (seller) 91 / producer (the beat's maker) 8 / platform 1.
insert into beat_settings(key, value) values
 ('revenue_model', '{"confirmed":true,"stream":null,"artist_pct":91,"producer_pct":8,"platform_pct":1,"public_text":null}'::jsonb)
on conflict (key) do update
  set value = beat_settings.value || '{"confirmed":true,"artist_pct":91,"producer_pct":8,"platform_pct":1}'::jsonb,
      updated_at = now();
