-- Run in Supabase → SQL Editor if you see "Could not find the 'bundle_id' column".
-- Safe to run multiple times (IF NOT EXISTS).

alter table review_links add column if not exists bundle_id uuid;
alter table review_links add column if not exists bundle_order int;
