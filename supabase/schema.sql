-- Supabase schema for Photo Hunt BD
create extension if not exists pgcrypto;
create table if not exists profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null,
 avatar_url text,
 xp integer not null default 0,
 missions_completed integer not null default 0,
 districts_completed integer not null default 0,
 streak integer not null default 0,
 role text not null default 'user' check (role in ('user','admin')),
 created_at timestamptz not null default now()
);
create table if not exists missions (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text,
 category text,
 xp integer not null default 100,
 division text,
 district text,
 upazila text,
 union_name text,
 village text,
 mouza text,
 latitude double precision,
 longitude double precision,
 radius_m integer not null default 150,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references profiles(id) on delete cascade,
 mission_id uuid not null references missions(id) on delete cascade,
 cloudinary_url text not null,
 cloudinary_public_id text,
 captured_lat double precision,
 captured_lng double precision,
 distance_m double precision,
 gps_verified boolean not null default false,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
alter table profiles enable row level security;
alter table missions enable row level security;
alter table submissions enable row level security;
create policy "profiles readable" on profiles for select using (true);
create policy "own profile insert" on profiles for insert with check (auth.uid()=id);
create policy "own profile update" on profiles for update using (auth.uid()=id);
create policy "missions public read" on missions for select using (active=true);
create policy "own submissions" on submissions for select using (auth.uid()=user_id);
create policy "own submission insert" on submissions for insert with check (auth.uid()=user_id);
-- IMPORTANT: approval/XP changes should be done by a trusted server/Edge Function, not by the browser.
