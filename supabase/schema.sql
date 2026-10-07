-- Photo Hunt BD production schema
-- Run this whole file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  xp integer not null default 0,
  missions_completed integer not null default 0,
  districts_completed integer not null default 0,
  streak integer not null default 0,
  total_explores integer not null default 0,
  districts_explored integer not null default 0,
  upazilas_explored integer not null default 0,
  unions_explored integer not null default 0,
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
  mission_id uuid references missions(id) on delete set null,
  cloudinary_url text not null,
  cloudinary_public_id text,
  captured_lat double precision,
  captured_lng double precision,
  distance_m double precision,
  gps_verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  caption text,
  location_label text,
  division text,
  district text,
  upazila text,
  union_name text,
  village text,
  mouza text,
  created_at timestamptz not null default now()
);

create table if not exists explorations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  location_key text not null,
  division text,
  district text,
  upazila text,
  union_name text,
  village text,
  mouza text,
  photo_url text not null,
  explored_at timestamptz not null default now(),
  unique(user_id, location_key)
);

create index if not exists submissions_status_idx on submissions(status);
create index if not exists submissions_user_idx on submissions(user_id);
create index if not exists explorations_user_idx on explorations(user_id);
create index if not exists explorations_location_idx on explorations(location_key);

alter table profiles enable row level security;
alter table missions enable row level security;
alter table submissions enable row level security;
alter table explorations enable row level security;

-- Safe public leaderboard/profile read.
drop policy if exists "profiles readable" on profiles;
create policy "profiles readable" on profiles for select using (true);

drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);

drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles for update using (auth.uid() = id);


-- Prevent a normal user from changing their own role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_admin(auth.uid()) then
    raise exception 'role_change_forbidden';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger
before update on public.profiles
for each row execute function public.protect_profile_role();

-- Active missions are public.
drop policy if exists "missions public read" on missions;
create policy "missions public read" on missions for select using (active = true);

-- A user can see own submissions; approved submissions are public for the community/photo cards.
drop policy if exists "own submissions" on submissions;
create policy "own submissions" on submissions for select using (auth.uid() = user_id or status = 'approved');

drop policy if exists "own submission insert" on submissions;
create policy "own submission insert" on submissions for insert with check (auth.uid() = user_id);

-- Users can see approved exploration records; owners can see their pending records.
drop policy if exists "explorations readable" on explorations;
create policy "explorations readable" on explorations for select using (auth.uid() = user_id or true);

-- Admin check helper. This is used only inside SECURITY DEFINER functions.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- Admin moderation function. The browser never receives the service_role key.
create or replace function public.moderate_submission(p_submission_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.submissions;
  loc_key text;
  inserted_count integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin_only';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'invalid_status';
  end if;

  update public.submissions
     set status = p_status
   where id = p_submission_id
   returning * into s;

  if s.id is null then
    raise exception 'submission_not_found';
  end if;

  if p_status = 'approved' then
    loc_key := coalesce(nullif(s.division,''),'') || '|' ||
               coalesce(nullif(s.district,''),'') || '|' ||
               coalesce(nullif(s.upazila,''),'') || '|' ||
               coalesce(nullif(s.union_name,''),'') || '|' ||
               coalesce(nullif(s.village,''),'') || '|' ||
               coalesce(nullif(s.mouza,''),'');

    if loc_key = '|||||' then
      loc_key := 'gps:' || round(coalesce(s.captured_lat,0)::numeric, 3)::text || ':' || round(coalesce(s.captured_lng,0)::numeric, 3)::text;
    end if;

    insert into public.explorations(
      user_id, submission_id, location_key, division, district, upazila,
      union_name, village, mouza, photo_url
    ) values (
      s.user_id, s.id, loc_key, s.division, s.district, s.upazila,
      s.union_name, s.village, s.mouza, s.cloudinary_url
    ) on conflict (user_id, location_key) do nothing;

    get diagnostics inserted_count = row_count;

    update public.profiles p
       set xp = p.xp + case when inserted_count > 0 then coalesce((select xp from public.missions where id=s.mission_id),100) else 0 end,
           missions_completed = p.missions_completed + case when inserted_count > 0 then 1 else 0 end,
           total_explores = (select count(*) from public.explorations e where e.user_id=s.user_id),
           districts_explored = (select count(distinct e.district) from public.explorations e where e.user_id=s.user_id and coalesce(e.district,'')<>''),
           upazilas_explored = (select count(distinct e.district || '|' || e.upazila) from public.explorations e where e.user_id=s.user_id and coalesce(e.upazila,'')<>''),
           unions_explored = (select count(distinct e.district || '|' || e.upazila || '|' || e.union_name) from public.explorations e where e.user_id=s.user_id and coalesce(e.union_name,'')<>'')
     where p.id=s.user_id;
  end if;

  return jsonb_build_object('ok',true,'status',p_status,'new_explore',inserted_count > 0);
end;
$$;

grant execute on function public.moderate_submission(uuid,text) to authenticated;

-- Admin can see all submissions and missions through RLS.
drop policy if exists "admin submissions read" on submissions;
create policy "admin submissions read" on submissions for select using (public.is_admin(auth.uid()));

drop policy if exists "admin missions write" on missions;
create policy "admin missions write" on missions for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Seed one harmless demo mission only if table is empty. Replace/delete it from admin after setup.
insert into public.missions(title,description,category,xp,division,district,upazila,union_name,latitude,longitude,radius_m,active)
select 'Your first Bangladesh Explore', 'Admin panel থেকে এই mission-এর location বদলে দিন।', 'explore', 100, 'ঢাকা', 'ঢাকা', 'সাভার', null, 23.8583, 90.2660, 500, true
where not exists (select 1 from public.missions);
