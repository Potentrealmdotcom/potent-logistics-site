-- Fleet depth columns (D24) — Nov 18, 2026.
-- RUN-ONCE-SAFE: run in Supabase > SQL Editor; every statement is a no-op if the
-- column already exists. The app works without this SQL (the new fields live in
-- local storage and the cloud save falls back to the legacy payload if the
-- server rejects the new columns); running it makes odometer readings, service
-- intervals, and per-record mileage sync to the cloud.

alter table public.fleet_vehicles add column if not exists odometer numeric;
alter table public.fleet_vehicles add column if not exists oil_interval_mo integer;
alter table public.fleet_vehicles add column if not exists tire_interval_mo integer;
alter table public.fleet_vehicles add column if not exists brake_interval_mo integer;
alter table public.fleet_maintenance add column if not exists odo_mi numeric;
