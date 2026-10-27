-- Self-serve POTENT team accounts (Oct 27, 2026). Run in Supabase > SQL Editor.
-- Replaces the numbered login slots (dispatch1-20, driver1-3): each team member
-- creates their OWN account (name + email + their own password + role picked at
-- signup) through auth.js action "signup". New accounts start as status
-- 'pending' with NO access until the owner approves them (auth.js
-- "listaccounts" / "approveaccount" / "setaccountrole"). The owner never
-- hand-makes a password again.
-- Passwords are stored ONLY as scrypt hashes (auth.js hashPw: scrypt$salt$hash).
-- Server-only, same as staff_logins / user_password_overrides: RLS on, no
-- policies, so the public anon key can read nothing. auth.js reaches this
-- table with the service_role key.
create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  role text not null default 'dispatch' check (role in ('dispatch','driver')),
  password_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);
-- Emails are stored lowercased by the server; enforce one account per email.
create unique index if not exists staff_accounts_email_uidx on public.staff_accounts (lower(email));
alter table public.staff_accounts enable row level security;
