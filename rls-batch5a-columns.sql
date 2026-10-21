-- Batch 5A (Oct 21, 2026): add the company column the secure gateway needs on three staff tables, and point existing rows at POTENT. Safe to run any time.
alter table public.employee_settings add column if not exists org_id uuid;
alter table public.driver_availability add column if not exists org_id uuid;
alter table public.vehicle_availability add column if not exists org_id uuid;
alter table public.b2b_pricing_settings add column if not exists org_id uuid;
update public.employee_settings set org_id = (select id from public.organizations where slug = 'potent-logistics' limit 1) where org_id is null;
update public.driver_availability set org_id = (select id from public.organizations where slug = 'potent-logistics' limit 1) where org_id is null;
update public.vehicle_availability set org_id = (select id from public.organizations where slug = 'potent-logistics' limit 1) where org_id is null;
update public.b2b_pricing_settings set org_id = (select id from public.organizations where slug = 'potent-logistics' limit 1) where org_id is null;
