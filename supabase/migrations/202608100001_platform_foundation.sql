create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  mobile_e164 text,
  avatar_path text,
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'review' check (status in ('review', 'active', 'suspended')),
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  role text not null check (role in ('superadmin', 'organization_admin', 'branch_admin', 'dispatcher', 'cashier', 'support', 'analyst')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, branch_id, role)
);

create table public.terminals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_active boolean not null default true
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  origin_terminal_id uuid not null references public.terminals(id),
  destination_terminal_id uuid not null references public.terminals(id),
  typical_duration_minutes integer not null check (typical_duration_minutes > 0),
  base_fare numeric(12, 2) not null check (base_fare >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  check (origin_terminal_id <> destination_terminal_id)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  route_id uuid not null references public.routes(id),
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  seats_sold integer not null default 0 check (seats_sold >= 0),
  fare numeric(12, 2) not null check (fare >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'boarding', 'ready', 'departed', 'arrived', 'completed', 'cancelled')),
  inventory_version bigint not null default 1,
  created_at timestamptz not null default now(),
  check (arrival_at > departure_at),
  check (seats_sold <= capacity)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users(id),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  trip_id uuid not null references public.trips(id),
  booking_status text not null default 'pending' check (booking_status in ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'processing', 'paid', 'partially_refunded', 'refunded', 'failed')),
  subtotal numeric(12, 2) not null,
  fees numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null,
  mobile_e164 text,
  seat_code text not null,
  eligibility_type text,
  unique (booking_id, seat_code)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id),
  branch_id uuid references public.branches(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index memberships_user_scope_idx on public.memberships (user_id, organization_id, branch_id) where status = 'active';
create index trips_search_idx on public.trips (route_id, departure_at, status);
create index trips_branch_departure_idx on public.trips (branch_id, departure_at);
create index bookings_user_created_idx on public.bookings (user_id, created_at desc);
create index bookings_scope_status_idx on public.bookings (organization_id, branch_id, booking_status, created_at desc);
create index audit_scope_created_idx on public.audit_events (organization_id, branch_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger organizations_touch_updated_at before update on public.organizations
for each row execute function public.touch_updated_at();

create trigger bookings_touch_updated_at before update on public.bookings
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, mobile_e164)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

create or replace function public.has_staff_scope(target_organization uuid, target_branch uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role = 'superadmin'
        or (
          m.organization_id = target_organization
          and (m.branch_id is null or target_branch is null or m.branch_id = target_branch)
        )
      )
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.memberships enable row level security;
alter table public.terminals enable row level security;
alter table public.routes enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_passengers enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_read_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "organizations_staff_read" on public.organizations for select
using (public.has_staff_scope(id, null));

create policy "branches_staff_read" on public.branches for select
using (public.has_staff_scope(organization_id, id));

create policy "memberships_read_own_or_scoped" on public.memberships for select
using (user_id = auth.uid() or public.has_staff_scope(organization_id, branch_id));

create policy "terminals_public_read" on public.terminals for select using (is_active);

create policy "routes_public_read" on public.routes for select using (status = 'published');
create policy "routes_staff_all" on public.routes for all
using (public.has_staff_scope(organization_id, null))
with check (public.has_staff_scope(organization_id, null));

create policy "trips_public_read" on public.trips for select using (status <> 'cancelled');
create policy "trips_staff_all" on public.trips for all
using (public.has_staff_scope(organization_id, branch_id))
with check (public.has_staff_scope(organization_id, branch_id));

create policy "bookings_passenger_read" on public.bookings for select using (user_id = auth.uid());
create policy "bookings_staff_read" on public.bookings for select using (public.has_staff_scope(organization_id, branch_id));
create policy "bookings_staff_update" on public.bookings for update
using (public.has_staff_scope(organization_id, branch_id))
with check (public.has_staff_scope(organization_id, branch_id));

create policy "booking_passengers_booking_owner_read" on public.booking_passengers for select
using (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy "booking_passengers_staff_read" on public.booking_passengers for select
using (exists (select 1 from public.bookings b where b.id = booking_id and public.has_staff_scope(b.organization_id, b.branch_id)));

create policy "audit_staff_read" on public.audit_events for select
using (public.has_staff_scope(organization_id, branch_id));

revoke all on function public.has_staff_scope(uuid, uuid) from public;
grant execute on function public.has_staff_scope(uuid, uuid) to authenticated;
