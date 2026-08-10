-- VanGO full Supabase bootstrap
-- Paste this file once into the Supabase SQL Editor for a NEW development project.
-- It creates application tables, indexes, triggers, RLS, permission helpers,
-- booking RPCs, storage buckets, and non-personal reference data.
-- No real passenger, booking, payment, or provider-secret data is included.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  mobile_e164 text,
  avatar_path text,
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text,
  support_email text,
  support_mobile_e164 text,
  status text not null default 'review'
    check (status in ('review', 'active', 'suspended', 'closed')),
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  timezone text not null default 'Asia/Manila',
  support_mobile_e164 text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, code)
);

create table if not exists public.permissions (
  code text primary key,
  domain text not null,
  description text not null,
  risk_level text not null default 'standard'
    check (risk_level in ('standard', 'sensitive', 'high'))
);

create table if not exists public.role_permissions (
  role text not null,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role, permission_code),
  check (role in ('superadmin', 'organization_admin', 'branch_admin', 'dispatcher', 'cashier', 'support', 'analyst'))
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  role text not null
    check (role in ('superadmin', 'organization_admin', 'branch_admin', 'dispatcher', 'cashier', 'support', 'analyst')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'expired')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (role = 'superadmin' and organization_id is null and branch_id is null)
    or (role <> 'superadmin' and organization_id is not null)
  ),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  unique nulls not distinct (user_id, organization_id, branch_id, role)
);

create table if not exists public.membership_permissions (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  primary key (membership_id, permission_code)
);

create table if not exists public.access_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.access_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  due_at timestamptz not null,
  completed_at timestamptz,
  result text check (result in ('approved', 'changes_required', 'revoked')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.terminals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  province text,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, city)
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  origin_terminal_id uuid not null references public.terminals(id),
  destination_terminal_id uuid not null references public.terminals(id),
  typical_duration_minutes integer not null check (typical_duration_minutes > 0),
  base_fare numeric(12, 2) not null check (base_fare >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_terminal_id <> destination_terminal_id),
  unique (id, organization_id),
  unique (organization_id, origin_terminal_id, destination_terminal_id)
);

create table if not exists public.schedule_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  weekdays smallint[] not null,
  departure_time time not null,
  effective_from date not null,
  effective_until date,
  fare numeric(12, 2) not null check (fare >= 0),
  capacity integer not null check (capacity > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  foreign key (route_id, organization_id) references public.routes(id, organization_id)
);

create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  schedule_rule_id uuid not null references public.schedule_rules(id) on delete cascade,
  service_date date not null,
  action text not null check (action in ('cancel', 'override', 'extra')),
  departure_time time,
  fare numeric(12, 2) check (fare >= 0),
  capacity integer check (capacity > 0),
  reason text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (schedule_rule_id, service_date)
);

alter table public.schedule_exceptions alter column created_by set default auth.uid();

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  plate_number text not null,
  model text,
  seat_layout_code text not null default 'van-15',
  capacity integer not null check (capacity > 0),
  status text not null default 'active'
    check (status in ('active', 'maintenance', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  unique (organization_id, plate_number)
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  full_name text not null,
  mobile_e164 text,
  license_number text not null,
  license_expiry date not null,
  status text not null default 'active'
    check (status in ('active', 'off_duty', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  unique (organization_id, license_number)
);

create table if not exists public.compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('organization', 'branch', 'vehicle', 'driver')),
  document_type text not null,
  validity_days integer check (validity_days is null or validity_days > 0),
  is_required boolean not null default true,
  is_active boolean not null default true,
  unique (entity_type, document_type)
);

create table if not exists public.compliance_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  entity_type text not null check (entity_type in ('organization', 'branch', 'vehicle', 'driver')),
  entity_id uuid not null,
  requirement_id uuid not null references public.compliance_requirements(id),
  storage_path text not null,
  issued_at date,
  expires_at date,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  route_id uuid not null references public.routes(id),
  schedule_rule_id uuid references public.schedule_rules(id) on delete set null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  seats_sold integer not null default 0 check (seats_sold >= 0),
  fare numeric(12, 2) not null check (fare >= 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ready', 'boarding', 'departed', 'arrived', 'completed', 'cancelled')),
  gate text,
  inventory_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (arrival_at > departure_at),
  check (seats_sold <= capacity),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  foreign key (route_id, organization_id) references public.routes(id, organization_id),
  unique (id, organization_id, branch_id)
);

create table if not exists public.trip_assignments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  driver_id uuid not null references public.drivers(id),
  assigned_by uuid not null references auth.users(id),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_seats (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  seat_code text not null,
  seat_class text not null default 'standard',
  is_accessibility boolean not null default false,
  state text not null default 'available'
    check (state in ('available', 'blocked', 'sold')),
  version bigint not null default 1,
  unique (trip_id, seat_code)
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  code text not null,
  title text not null,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  max_discount numeric(12, 2) check (max_discount is null or max_discount > 0),
  minimum_subtotal numeric(12, 2) not null default 0,
  total_redemption_limit integer check (total_redemption_limit is null or total_redemption_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'paused', 'ended')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  unique nulls not distinct (organization_id, code)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users(id),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  trip_id uuid not null references public.trips(id),
  booking_status text not null default 'pending'
    check (booking_status in ('pending', 'confirmed', 'completed', 'cancelled', 'expired')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'processing', 'paid', 'partially_refunded', 'refunded', 'failed')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  fees numeric(12, 2) not null default 0 check (fees >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null check (total >= 0),
  currency text not null default 'PHP',
  version bigint not null default 1,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id),
  foreign key (trip_id, organization_id, branch_id) references public.trips(id, organization_id, branch_id)
);

create table if not exists public.seat_holds (
  id uuid primary key default gen_random_uuid(),
  hold_group uuid not null,
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_seat_id uuid not null references public.trip_seats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'released', 'expired', 'converted')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  hold_group uuid not null,
  promotion_id uuid references public.promotions(id) on delete set null,
  subtotal numeric(12, 2) not null,
  fees numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  currency text not null default 'PHP',
  pricing_version bigint not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  full_name text not null,
  mobile_e164 text,
  age smallint check (age is null or age between 0 and 120),
  seat_code text not null,
  eligibility_type text check (eligibility_type is null or eligibility_type in ('pwd', 'senior', 'student')),
  created_at timestamptz not null default now(),
  unique (booking_id, seat_code),
  unique (trip_id, seat_code)
);

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id),
  user_id uuid not null references auth.users(id),
  booking_id uuid not null unique references public.bookings(id),
  discount_amount numeric(12, 2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider text not null default 'mock' check (provider = 'mock'),
  provider_intent_id text,
  method text not null default 'mock_payment' check (method = 'mock_payment'),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'PHP',
  status text not null default 'created'
    check (status in ('created', 'requires_action', 'processing', 'succeeded', 'failed', 'cancelled')),
  idempotency_key text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (provider, provider_intent_id)
);

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  payment_intent_id uuid references public.payment_intents(id) on delete set null,
  provider text not null default 'mock' check (provider = 'mock'),
  provider_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'ignored', 'failed')),
  attempt_count integer not null default 0,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  payment_intent_id uuid not null references public.payment_intents(id),
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'processing', 'succeeded', 'failed', 'rejected')),
  provider_refund_id text,
  requested_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  period_start date not null,
  period_end date not null,
  gross_amount numeric(14, 2) not null default 0,
  fee_amount numeric(14, 2) not null default 0,
  adjustment_amount numeric(14, 2) not null default 0,
  payout_amount numeric(14, 2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'processing', 'paid', 'held')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (organization_id, period_start, period_end)
);

create table if not exists public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  booking_id uuid references public.bookings(id),
  payment_intent_id uuid references public.payment_intents(id),
  item_type text not null check (item_type in ('booking', 'fee', 'refund', 'adjustment')),
  amount numeric(14, 2) not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  requester_id uuid not null references auth.users(id),
  booking_id uuid references public.bookings(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  assigned_to uuid references auth.users(id),
  subject text not null,
  category text not null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new'
    check (status in ('new', 'open', 'waiting_customer', 'waiting_internal', 'resolved', 'closed')),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  visibility text not null default 'customer'
    check (visibility in ('customer', 'internal')),
  body text not null,
  attachment_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  action_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'sms')),
  provider text,
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'cancelled')),
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.branch_settings (
  branch_id uuid not null references public.branches(id) on delete cascade,
  key text not null,
  value jsonb not null,
  version bigint not null default 1,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (branch_id, key)
);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  version bigint not null default 1,
  published_by uuid references auth.users(id),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Auth users are provisioned through the server-only Supabase Admin API. This
-- private marker makes that deploy-time operation idempotent without exposing
-- credentials or privileged account identifiers to browser clients.
create table if not exists public.system_bootstrap_state (
  key text primary key,
  superadmin_user_id uuid references auth.users(id) on delete set null,
  admin_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  integration_type text not null,
  environment text not null default 'development'
    check (environment in ('development', 'staging', 'production')),
  public_metadata jsonb not null default '{}',
  secret_reference text,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'connected', 'degraded', 'disabled')),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, integration_type, environment)
);

create table if not exists public.webhook_deliveries (
  id bigint generated always as identity primary key,
  integration_id uuid not null references public.integration_connections(id) on delete cascade,
  event_type text not null,
  event_id text not null,
  destination_host text not null,
  status text not null default 'queued'
    check (status in ('queued', 'delivered', 'failed', 'cancelled')),
  response_code integer,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (integration_id, event_id)
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  severity text not null check (severity in ('minor', 'major', 'critical')),
  status text not null default 'investigating'
    check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id),
  branch_id uuid references public.branches(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  request_id text,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists memberships_user_scope_idx on public.memberships (user_id, organization_id, branch_id) where status = 'active';
create index if not exists trips_search_idx on public.trips (route_id, departure_at, status);
create index if not exists trips_branch_departure_idx on public.trips (branch_id, departure_at);
create index if not exists trip_seats_trip_state_idx on public.trip_seats (trip_id, state);
create unique index if not exists seat_holds_one_active_seat_idx on public.seat_holds (trip_seat_id) where status = 'active';
create index if not exists seat_holds_user_group_idx on public.seat_holds (user_id, hold_group, status);
create index if not exists seat_holds_expiry_idx on public.seat_holds (expires_at) where status = 'active';
create index if not exists bookings_user_created_idx on public.bookings (user_id, created_at desc);
create index if not exists bookings_scope_status_idx on public.bookings (organization_id, branch_id, booking_status, created_at desc);
create index if not exists booking_passengers_trip_idx on public.booking_passengers (trip_id);
create index if not exists payment_intents_booking_idx on public.payment_intents (booking_id, created_at desc);
create index if not exists support_cases_scope_status_idx on public.support_cases (organization_id, branch_id, status, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists audit_scope_created_idx on public.audit_events (organization_id, branch_id, created_at desc);
create index if not exists compliance_expiry_idx on public.compliance_documents (expires_at, review_status);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, mobile_e164)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.phone, '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'organizations', 'branches', 'memberships', 'terminals',
    'routes', 'schedule_rules', 'vehicles', 'drivers', 'trips',
    'trip_assignments', 'promotions', 'bookings', 'payment_intents',
    'refunds', 'settlements', 'support_cases', 'platform_settings',
    'integration_connections', 'incidents'
  ]
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', target_table, target_table);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', target_table, target_table);
  end loop;
end;
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.role = 'superadmin'
      and m.status = 'active'
      and p.account_status = 'active'
      and m.valid_from <= now()
      and (m.valid_until is null or m.valid_until > now())
  );
$$;

create or replace function public.has_active_staff_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and p.account_status = 'active'
      and m.valid_from <= now()
      and (m.valid_until is null or m.valid_until > now())
  );
$$;

create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.organization_id = target_organization_id
      and m.status = 'active'
      and p.account_status = 'active'
      and m.valid_from <= now()
      and (m.valid_until is null or m.valid_until > now())
  );
$$;

create or replace function public.can_access_branch(target_organization_id uuid, target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.user_id = auth.uid()
      and m.organization_id = target_organization_id
      and (m.branch_id is null or m.branch_id = target_branch_id)
      and m.status = 'active'
      and p.account_status = 'active'
      and m.valid_from <= now()
      and (m.valid_until is null or m.valid_until > now())
  );
$$;

create or replace function public.has_permission(
  target_permission text,
  target_organization_id uuid default null,
  target_branch_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join public.role_permissions rp on rp.role = m.role and rp.permission_code = target_permission
    left join public.membership_permissions denied
      on denied.membership_id = m.id
      and denied.permission_code = target_permission
      and denied.effect = 'deny'
    where m.user_id = auth.uid()
      and m.status = 'active'
      and p.account_status = 'active'
      and m.valid_from <= now()
      and (m.valid_until is null or m.valid_until > now())
      and denied.membership_id is null
      and (target_organization_id is null or m.organization_id = target_organization_id)
      and (target_branch_id is null or m.branch_id is null or m.branch_id = target_branch_id)
  ) or exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join public.membership_permissions allowed
      on allowed.membership_id = m.id
      and allowed.permission_code = target_permission
      and allowed.effect = 'allow'
    where m.user_id = auth.uid()
      and m.status = 'active'
      and p.account_status = 'active'
      and m.valid_from <= now()
      and (m.valid_until is null or m.valid_until > now())
      and (target_organization_id is null or m.organization_id = target_organization_id)
      and (target_branch_id is null or m.branch_id is null or m.branch_id = target_branch_id)
  );
$$;

create or replace function public.resolve_my_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'profile', coalesce((select to_jsonb(p) from public.profiles p where p.id = auth.uid()), '{}'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'role', m.role,
        'organization_id', m.organization_id,
        'organization_name', o.name,
        'branch_id', m.branch_id,
        'branch_name', b.name
      ) order by m.created_at)
      from public.memberships m
      left join public.organizations o on o.id = m.organization_id
      left join public.branches b on b.id = m.branch_id
      where m.user_id = auth.uid()
        and m.status = 'active'
        and m.valid_from <= now()
        and (m.valid_until is null or m.valid_until > now())
    ), '[]'::jsonb)
  );
$$;

create or replace function public.search_available_trips(
  origin_id uuid,
  destination_id uuid,
  travel_date date,
  passenger_count integer default 1
)
returns table (
  trip_id uuid,
  organization_id uuid,
  operator_name text,
  route_id uuid,
  origin_name text,
  destination_name text,
  departure_at timestamptz,
  arrival_at timestamptz,
  fare numeric,
  capacity integer,
  available_seats bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.organization_id,
    o.name,
    r.id,
    origin.name,
    destination.name,
    t.departure_at,
    t.arrival_at,
    t.fare,
    t.capacity,
    count(ts.id) filter (
      where ts.state = 'available'
        and not exists (
          select 1 from public.seat_holds sh
          where sh.trip_seat_id = ts.id
            and sh.status = 'active'
            and sh.expires_at > now()
        )
    ) as available_seats
  from public.trips t
  join public.routes r on r.id = t.route_id
  join public.organizations o on o.id = t.organization_id and o.status = 'active'
  join public.terminals origin on origin.id = r.origin_terminal_id
  join public.terminals destination on destination.id = r.destination_terminal_id
  left join public.trip_seats ts on ts.trip_id = t.id
  where r.origin_terminal_id = origin_id
    and r.destination_terminal_id = destination_id
    and (t.departure_at at time zone 'Asia/Manila')::date = travel_date
    and r.status = 'published'
    and t.status in ('scheduled', 'ready')
    and t.departure_at > now()
  group by t.id, o.name, r.id, origin.name, destination.name
  having count(ts.id) filter (
    where ts.state = 'available'
      and not exists (
        select 1 from public.seat_holds sh
        where sh.trip_seat_id = ts.id
          and sh.status = 'active'
          and sh.expires_at > now()
      )
  ) >= greatest(passenger_count, 1)
  order by t.departure_at;
$$;

create or replace function public.hold_trip_seats(
  target_trip_id uuid,
  seat_codes text[],
  ttl_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  group_id uuid := gen_random_uuid();
  normalized_codes text[];
  requested_count integer;
  available_count integer;
  hold_until timestamptz;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  normalized_codes := array(select distinct upper(trim(value)) from unnest(seat_codes) value where trim(value) <> '');
  requested_count := coalesce(array_length(normalized_codes, 1), 0);
  if requested_count < 1 or requested_count > 8 then raise exception 'Select between 1 and 8 seats'; end if;
  if ttl_seconds < 120 or ttl_seconds > 900 then raise exception 'Invalid hold duration'; end if;

  perform pg_advisory_xact_lock(hashtext(target_trip_id::text));
  update public.seat_holds
  set status = 'expired'
  where trip_id = target_trip_id and status = 'active' and expires_at <= now();

  if not exists (
    select 1
    from public.trips t
    join public.routes r on r.id = t.route_id and r.status = 'published'
    join public.organizations o on o.id = t.organization_id and o.status = 'active'
    where t.id = target_trip_id
      and t.status in ('scheduled', 'ready')
      and t.departure_at > now()
  ) then raise exception 'Trip is not available'; end if;

  select count(*) into available_count
  from public.trip_seats ts
  where ts.trip_id = target_trip_id
    and ts.seat_code = any(normalized_codes)
    and ts.state = 'available'
    and not exists (
      select 1 from public.seat_holds sh
      where sh.trip_seat_id = ts.id and sh.status = 'active'
    );
  if available_count <> requested_count then raise exception 'One or more seats are no longer available'; end if;

  hold_until := now() + make_interval(secs => ttl_seconds);
  insert into public.seat_holds (hold_group, trip_id, trip_seat_id, user_id, expires_at)
  select group_id, target_trip_id, ts.id, caller, hold_until
  from public.trip_seats ts
  where ts.trip_id = target_trip_id and ts.seat_code = any(normalized_codes);

  -- Emit a scoped Realtime event without changing the trip's optimistic-lock
  -- version. Other passengers then reload the authoritative seat map/search.
  update public.trips set updated_at = now() where id = target_trip_id;

  return jsonb_build_object('hold_group', group_id, 'expires_at', hold_until, 'seat_codes', normalized_codes);
end;
$$;

create or replace function public.get_trip_seat_map(target_trip_id uuid)
returns table (
  seat_id uuid,
  seat_code text,
  seat_class text,
  is_accessibility boolean,
  seat_state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ts.id,
    ts.seat_code,
    ts.seat_class,
    ts.is_accessibility,
    case
      when ts.state <> 'available' then ts.state
      when exists (
        select 1 from public.seat_holds sh
        where sh.trip_seat_id = ts.id and sh.status = 'active' and sh.expires_at > now()
      ) then 'held'
      else 'available'
    end
  from public.trip_seats ts
  join public.trips t on t.id = ts.trip_id
  join public.routes r on r.id = t.route_id and r.status = 'published'
  join public.organizations o on o.id = t.organization_id and o.status = 'active'
  where ts.trip_id = target_trip_id
    and t.status in ('scheduled', 'ready')
    and t.departure_at > now()
  order by (substring(ts.seat_code from '^[0-9]+'))::integer, right(ts.seat_code, 1);
$$;

create or replace function public.release_seat_hold(target_hold_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  released_trip uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select trip_id into released_trip
  from public.seat_holds
  where hold_group = target_hold_group and user_id = caller and status = 'active'
  limit 1;

  update public.seat_holds
  set status = 'released'
  where hold_group = target_hold_group and user_id = caller and status = 'active';

  if released_trip is not null then
    update public.trips set updated_at = now() where id = released_trip;
  end if;
end;
$$;

create or replace function public.quote_booking(target_hold_group uuid, promotion_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_trip public.trips%rowtype;
  seat_count integer;
  subtotal_amount numeric(12,2);
  fee_amount numeric(12,2) := 0;
  discount_amount numeric(12,2) := 0;
  promo public.promotions%rowtype;
  quote_id uuid;
  quote_expiry timestamptz;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select count(*), min(expires_at) into seat_count, quote_expiry
  from public.seat_holds
  where hold_group = target_hold_group and user_id = caller and status = 'active' and expires_at > now();
  if seat_count < 1 then raise exception 'Seat hold is missing or expired'; end if;
  select t.* into strict target_trip
  from public.trips t
  join public.seat_holds sh on sh.trip_id = t.id
  where sh.hold_group = target_hold_group and sh.user_id = caller
  limit 1;
  subtotal_amount := target_trip.fare * seat_count;

  if nullif(trim(promotion_code), '') is not null then
    select * into promo
    from public.promotions p
    where upper(p.code) = upper(trim(promotion_code))
      and p.status = 'live' and now() between p.starts_at and p.ends_at
      and (p.organization_id is null or p.organization_id = target_trip.organization_id)
      and (p.branch_id is null or p.branch_id = target_trip.branch_id)
      and subtotal_amount >= p.minimum_subtotal;
    if found then
      if promo.per_user_limit <= (
        select count(*) from public.promotion_redemptions pr
        where pr.promotion_id = promo.id and pr.user_id = caller
      ) then raise exception 'Promotion redemption limit reached'; end if;
      if promo.total_redemption_limit is not null and promo.total_redemption_limit <= (
        select count(*) from public.promotion_redemptions pr where pr.promotion_id = promo.id
      ) then raise exception 'Promotion is fully redeemed'; end if;
      discount_amount := case when promo.discount_type = 'fixed' then promo.discount_value else subtotal_amount * promo.discount_value / 100 end;
      discount_amount := least(discount_amount, coalesce(promo.max_discount, discount_amount), subtotal_amount);
    end if;
  end if;

  insert into public.booking_quotes (
    user_id, trip_id, hold_group, promotion_id, subtotal, fees, discount, total,
    pricing_version, expires_at
  ) values (
    caller, target_trip.id, target_hold_group, promo.id, subtotal_amount, fee_amount,
    discount_amount, subtotal_amount + fee_amount - discount_amount,
    target_trip.inventory_version, least(quote_expiry, now() + interval '10 minutes')
  ) returning id into quote_id;

  return (select to_jsonb(q) from public.booking_quotes q where q.id = quote_id);
end;
$$;

create or replace function public.confirm_booking(target_quote_id uuid, passengers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  quote_row public.booking_quotes%rowtype;
  target_trip public.trips%rowtype;
  new_booking_id uuid;
  booking_reference text;
  passenger_count integer;
  hold_count integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into strict quote_row from public.booking_quotes
  where id = target_quote_id and user_id = caller for update;
  if quote_row.used_at is not null or quote_row.expires_at <= now() then raise exception 'Quote is no longer valid'; end if;
  select * into strict target_trip from public.trips where id = quote_row.trip_id for update;
  if target_trip.inventory_version <> quote_row.pricing_version then raise exception 'Trip inventory changed; request a new quote'; end if;
  passenger_count := jsonb_array_length(passengers);
  select count(*) into hold_count from public.seat_holds
  where hold_group = quote_row.hold_group and user_id = caller and status = 'active' and expires_at > now();
  if passenger_count <> hold_count or hold_count < 1 then raise exception 'Passenger details must match held seats'; end if;
  if exists (
    select 1 from jsonb_array_elements(passengers) p
    where nullif(trim(p ->> 'full_name'), '') is null or nullif(trim(p ->> 'seat_code'), '') is null
  ) then raise exception 'Passenger name and seat are required'; end if;
  if exists (
    select 1 from jsonb_array_elements(passengers) p
    where upper(trim(p ->> 'seat_code')) not in (
      select ts.seat_code from public.seat_holds sh join public.trip_seats ts on ts.id = sh.trip_seat_id
      where sh.hold_group = quote_row.hold_group and sh.user_id = caller and sh.status = 'active'
    )
  ) then raise exception 'Passenger seat does not match the active hold'; end if;

  loop
    booking_reference := 'VG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.bookings where reference = booking_reference);
  end loop;

  insert into public.bookings (
    reference, user_id, organization_id, branch_id, trip_id,
    subtotal, fees, discount, total, currency
  ) values (
    booking_reference, caller, target_trip.organization_id, target_trip.branch_id, target_trip.id,
    quote_row.subtotal, quote_row.fees, quote_row.discount, quote_row.total, quote_row.currency
  ) returning id into new_booking_id;

  insert into public.booking_passengers (booking_id, trip_id, full_name, mobile_e164, age, seat_code, eligibility_type)
  select new_booking_id, target_trip.id, trim(p ->> 'full_name'), nullif(trim(p ->> 'mobile_e164'), ''),
    nullif(p ->> 'age', '')::smallint, upper(trim(p ->> 'seat_code')), nullif(p ->> 'eligibility_type', '')
  from jsonb_array_elements(passengers) p;

  update public.seat_holds set status = 'converted', booking_id = new_booking_id
  where hold_group = quote_row.hold_group and user_id = caller and status = 'active';
  update public.trip_seats set state = 'sold', version = version + 1
  where id in (select trip_seat_id from public.seat_holds where hold_group = quote_row.hold_group and user_id = caller);
  update public.trips set seats_sold = seats_sold + hold_count, inventory_version = inventory_version + 1
  where id = target_trip.id;
  update public.booking_quotes set used_at = now() where id = target_quote_id;
  if quote_row.promotion_id is not null then
    insert into public.promotion_redemptions (promotion_id, user_id, booking_id, discount_amount)
    values (quote_row.promotion_id, caller, new_booking_id, quote_row.discount);
  end if;
  insert into public.audit_events (actor_id, organization_id, branch_id, entity_type, entity_id, action)
  values (caller, target_trip.organization_id, target_trip.branch_id, 'booking', new_booking_id::text, 'booking.created');
  return jsonb_build_object('booking_id', new_booking_id, 'reference', booking_reference, 'payment_status', 'unpaid');
end;
$$;

create or replace function public.complete_mock_payment(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_booking public.bookings%rowtype;
  mock_payment_id uuid;
  mock_key text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into strict target_booking from public.bookings where id = target_booking_id for update;
  if target_booking.user_id <> caller then raise exception 'Permission denied'; end if;
  if target_booking.payment_status = 'paid' then
    select id into mock_payment_id from public.payment_intents
    where booking_id = target_booking_id and provider = 'mock' and status = 'succeeded'
    order by created_at desc limit 1;
    return jsonb_build_object('payment_id', mock_payment_id, 'reference', target_booking.reference, 'status', 'succeeded', 'mock', true);
  end if;
  if target_booking.booking_status not in ('pending', 'confirmed') then raise exception 'Booking cannot be paid'; end if;

  mock_key := 'mock:' || target_booking_id::text;
  insert into public.payment_intents (
    booking_id, provider, provider_intent_id, method, amount, currency,
    status, idempotency_key
  ) values (
    target_booking_id, 'mock', 'MOCK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    'mock_payment', target_booking.total, target_booking.currency,
    'succeeded', mock_key
  ) on conflict (idempotency_key) do update set updated_at = now()
  returning id into mock_payment_id;

  insert into public.payment_events (
    payment_intent_id, provider, provider_event_id, event_type, payload_hash,
    processing_status, attempt_count, processed_at
  ) values (
    mock_payment_id, 'mock', 'MOCK-COMPLETE-' || target_booking_id::text,
    'mock.payment.succeeded',
    encode(sha256(convert_to(target_booking_id::text || ':' || target_booking.total::text, 'UTF8')), 'hex'),
    'processed', 1, now()
  ) on conflict (provider, provider_event_id) do nothing;

  update public.bookings
  set payment_status = 'paid', booking_status = 'confirmed', version = version + 1
  where id = target_booking_id;
  insert into public.notifications (user_id, type, title, body, action_path)
  values (caller, 'booking_confirmed', 'Booking confirmed', 'Your mock payment was recorded. No real money was charged.', '/passenger/ticket?reference=' || target_booking.reference);
  insert into public.audit_events (actor_id, organization_id, branch_id, entity_type, entity_id, action, metadata)
  values (caller, target_booking.organization_id, target_booking.branch_id, 'payment', mock_payment_id::text, 'payment.mock_completed', jsonb_build_object('booking_id', target_booking_id, 'charged_real_money', false));
  return jsonb_build_object('payment_id', mock_payment_id, 'reference', target_booking.reference, 'status', 'succeeded', 'mock', true, 'charged_real_money', false);
end;
$$;

create or replace function public.transition_trip_status(target_trip_id uuid, next_status text, expected_version bigint, change_reason text default null)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_trip public.trips%rowtype;
begin
  select * into strict current_trip from public.trips where id = target_trip_id for update;
  if not public.has_permission('trips.manage', current_trip.organization_id, current_trip.branch_id) then raise exception 'Permission denied'; end if;
  if current_trip.inventory_version <> expected_version then raise exception 'Trip was updated by another user'; end if;
  if not (
    (current_trip.status = 'scheduled' and next_status in ('ready', 'cancelled')) or
    (current_trip.status = 'ready' and next_status in ('boarding', 'cancelled')) or
    (current_trip.status = 'boarding' and next_status in ('departed', 'cancelled')) or
    (current_trip.status = 'departed' and next_status = 'arrived') or
    (current_trip.status = 'arrived' and next_status = 'completed')
  ) then raise exception 'Invalid trip status transition'; end if;
  update public.trips set status = next_status, inventory_version = inventory_version + 1
  where id = target_trip_id returning * into current_trip;
  insert into public.audit_events (actor_id, organization_id, branch_id, entity_type, entity_id, action, reason)
  values (auth.uid(), current_trip.organization_id, current_trip.branch_id, 'trip', current_trip.id::text, 'trip.status_changed', change_reason);
  return current_trip;
end;
$$;

create or replace function public.request_refund(target_booking_id uuid, requested_reason text)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking public.bookings%rowtype;
  target_payment public.payment_intents%rowtype;
  new_refund public.refunds%rowtype;
begin
  select * into strict target_booking from public.bookings where id = target_booking_id;
  if target_booking.user_id <> auth.uid()
     and not public.has_permission('refunds.create', target_booking.organization_id, target_booking.branch_id)
  then raise exception 'Permission denied'; end if;
  if target_booking.payment_status not in ('paid', 'partially_refunded') then raise exception 'Booking has no refundable payment'; end if;
  select * into strict target_payment from public.payment_intents
  where booking_id = target_booking_id and status = 'succeeded' order by created_at desc limit 1;
  if exists (select 1 from public.refunds where booking_id = target_booking_id and status in ('requested', 'approved', 'processing'))
  then raise exception 'A refund is already in progress'; end if;
  insert into public.refunds (booking_id, payment_intent_id, amount, reason, requested_by)
  values (target_booking_id, target_payment.id, target_booking.total, trim(requested_reason), auth.uid())
  returning * into new_refund;
  return new_refund;
end;
$$;

create or replace function public.assign_trip_resources(
  target_trip_id uuid,
  target_vehicle_id uuid,
  target_driver_id uuid,
  expected_version bigint default null
)
returns public.trip_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_trip public.trips%rowtype;
  target_vehicle public.vehicles%rowtype;
  target_driver public.drivers%rowtype;
  current_assignment public.trip_assignments%rowtype;
  saved_assignment public.trip_assignments%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into strict target_trip from public.trips where id = target_trip_id for update;
  if not public.has_permission('trips.manage', target_trip.organization_id, target_trip.branch_id)
  then raise exception 'Permission denied'; end if;

  select * into strict target_vehicle from public.vehicles where id = target_vehicle_id for share;
  select * into strict target_driver from public.drivers where id = target_driver_id for share;
  if target_vehicle.organization_id <> target_trip.organization_id
     or (target_vehicle.branch_id is not null and target_vehicle.branch_id <> target_trip.branch_id)
  then raise exception 'Vehicle is outside the trip scope'; end if;
  if target_driver.organization_id <> target_trip.organization_id
     or (target_driver.branch_id is not null and target_driver.branch_id <> target_trip.branch_id)
  then raise exception 'Driver is outside the trip scope'; end if;
  if target_vehicle.status <> 'active' then raise exception 'Vehicle is not active'; end if;
  if target_driver.status <> 'active' then raise exception 'Driver is not active'; end if;
  if target_vehicle.capacity < target_trip.capacity then raise exception 'Vehicle capacity is below trip capacity'; end if;
  if target_trip.status in ('departed', 'arrived', 'completed', 'cancelled')
  then raise exception 'Resources cannot be changed for this trip status'; end if;

  select * into current_assignment from public.trip_assignments where trip_id = target_trip_id for update;
  if current_assignment.id is not null and expected_version is not null and current_assignment.version <> expected_version
  then raise exception 'Assignment was updated by another operator'; end if;
  insert into public.trip_assignments (trip_id, vehicle_id, driver_id, assigned_by)
  values (target_trip_id, target_vehicle_id, target_driver_id, caller)
  on conflict (trip_id) do update
    set vehicle_id = excluded.vehicle_id,
        driver_id = excluded.driver_id,
        assigned_by = excluded.assigned_by,
        version = public.trip_assignments.version + 1,
        updated_at = now()
  returning * into saved_assignment;
  return saved_assignment;
end;
$$;

create or replace function public.create_support_case(
  target_booking_id uuid,
  case_subject text,
  case_category text,
  case_priority text,
  first_message text
)
returns public.support_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_booking public.bookings%rowtype;
  new_case public.support_cases%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if length(trim(case_subject)) not between 4 and 160 then raise exception 'Subject must be between 4 and 160 characters'; end if;
  if length(trim(case_category)) not between 2 and 50 then raise exception 'Category must be between 2 and 50 characters'; end if;
  if case_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'Invalid support priority'; end if;
  if length(trim(first_message)) not between 4 and 5000 then raise exception 'Message must be between 4 and 5000 characters'; end if;
  if target_booking_id is not null then
    select * into strict target_booking from public.bookings where id = target_booking_id;
    if target_booking.user_id <> caller
       and not public.has_permission('support.manage', target_booking.organization_id, target_booking.branch_id)
    then raise exception 'Permission denied'; end if;
  end if;

  insert into public.support_cases (
    case_number, requester_id, booking_id, organization_id, branch_id,
    subject, category, priority, status
  ) values (
    'VGO-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    caller, target_booking_id, target_booking.organization_id, target_booking.branch_id,
    trim(case_subject), lower(trim(case_category)), case_priority, 'new'
  ) returning * into new_case;
  insert into public.support_messages (case_id, author_id, visibility, body)
  values (new_case.id, caller, 'customer', trim(first_message));
  return new_case;
end;
$$;

create or replace function public.transition_refund_status(
  target_refund_id uuid,
  next_status text,
  review_reason text default null
)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_refund public.refunds%rowtype;
  target_booking public.bookings%rowtype;
  target_payment public.payment_intents%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into strict current_refund from public.refunds where id = target_refund_id for update;
  select * into strict target_booking from public.bookings where id = current_refund.booking_id for update;
  select * into strict target_payment from public.payment_intents where id = current_refund.payment_intent_id;
  if not public.is_superadmin()
     and not public.has_permission('refunds.approve', target_booking.organization_id, target_booking.branch_id)
  then raise exception 'Permission denied'; end if;
  if target_payment.provider <> 'mock' or target_payment.method <> 'mock_payment'
  then raise exception 'Only mock refunds are supported'; end if;
  if not (
    (current_refund.status = 'requested' and next_status in ('approved', 'rejected')) or
    (current_refund.status = 'approved' and next_status in ('processing', 'rejected')) or
    (current_refund.status = 'processing' and next_status in ('succeeded', 'failed'))
  ) then raise exception 'Invalid refund status transition'; end if;
  if next_status in ('rejected', 'failed') and length(trim(coalesce(review_reason, ''))) < 4
  then raise exception 'A review reason is required'; end if;

  update public.refunds
  set status = next_status,
      approved_by = case when next_status = 'approved' then caller else approved_by end,
      provider_refund_id = case when next_status = 'succeeded' then 'MOCK-RF-' || upper(substr(replace(id::text, '-', ''), 1, 12)) else provider_refund_id end,
      updated_at = now()
  where id = target_refund_id
  returning * into current_refund;
  if next_status = 'succeeded' then
    update public.bookings set payment_status = 'refunded', version = version + 1, updated_at = now()
    where id = current_refund.booking_id;
  end if;
  insert into public.audit_events (actor_id, organization_id, branch_id, entity_type, entity_id, action, reason, metadata)
  values (caller, target_booking.organization_id, target_booking.branch_id, 'refund', current_refund.id::text,
    'refund.status_changed', nullif(trim(coalesce(review_reason, '')), ''),
    jsonb_build_object('status', next_status, 'mock', true, 'charged_real_money', false));
  return current_refund;
end;
$$;

create or replace function public.review_compliance_document(
  target_document_id uuid,
  next_status text,
  review_notes text default null
)
returns public.compliance_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_document public.compliance_documents%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into strict target_document from public.compliance_documents where id = target_document_id for update;
  if not public.is_superadmin()
     and not public.has_permission('fleet.manage', target_document.organization_id, target_document.branch_id)
  then raise exception 'Permission denied'; end if;
  if next_status not in ('approved', 'rejected', 'expired') then raise exception 'Invalid compliance review status'; end if;
  if next_status = 'rejected' and length(trim(coalesce(review_notes, ''))) < 4
  then raise exception 'Review notes are required when rejecting a document'; end if;
  update public.compliance_documents
  set review_status = next_status,
      reviewed_by = caller,
      reviewed_at = now(),
      review_notes = nullif(trim(coalesce(review_notes, '')), '')
  where id = target_document_id
  returning * into target_document;
  insert into public.audit_events (actor_id, organization_id, branch_id, entity_type, entity_id, action, reason, metadata)
  values (caller, target_document.organization_id, target_document.branch_id, 'compliance_document', target_document.id::text,
    'compliance.reviewed', target_document.review_notes, jsonb_build_object('status', next_status));
  return target_document;
end;
$$;

create or replace function public.set_branch_setting(
  target_branch_id uuid,
  setting_key text,
  setting_value jsonb,
  expected_version bigint default null
)
returns public.branch_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_branch public.branches%rowtype;
  current_setting public.branch_settings%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if length(trim(setting_key)) not between 2 and 80 then raise exception 'Setting key must be between 2 and 80 characters'; end if;
  select * into strict target_branch from public.branches where id = target_branch_id;
  if not public.has_permission('settings.manage', target_branch.organization_id, target_branch.id)
  then raise exception 'Permission denied'; end if;
  select * into current_setting from public.branch_settings where branch_id = target_branch_id and key = trim(setting_key) for update;
  if current_setting.key is not null and expected_version is not null and current_setting.version <> expected_version
  then raise exception 'Setting was updated by another operator'; end if;
  insert into public.branch_settings (branch_id, key, value, updated_by)
  values (target_branch_id, trim(setting_key), setting_value, caller)
  on conflict (branch_id, key) do update
    set value = excluded.value,
        version = public.branch_settings.version + 1,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into current_setting;
  return current_setting;
end;
$$;

create or replace function public.set_platform_setting(
  setting_key text,
  setting_value jsonb,
  expected_version bigint default null
)
returns public.platform_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_setting public.platform_settings%rowtype;
begin
  if caller is null or not public.is_superadmin() then raise exception 'Permission denied'; end if;
  if length(trim(setting_key)) not between 2 and 80 then raise exception 'Setting key must be between 2 and 80 characters'; end if;
  select * into current_setting from public.platform_settings where key = trim(setting_key) for update;
  if current_setting.key is not null and expected_version is not null and current_setting.version <> expected_version
  then raise exception 'Setting was updated by another administrator'; end if;
  insert into public.platform_settings (key, value, published_by, published_at)
  values (trim(setting_key), setting_value, caller, now())
  on conflict (key) do update
    set value = excluded.value,
        version = public.platform_settings.version + 1,
        published_by = excluded.published_by,
        published_at = excluded.published_at,
        updated_at = now()
  returning * into current_setting;
  return current_setting;
end;
$$;

create or replace function public.create_access_invitation(
  invite_email text,
  invite_role text,
  target_organization_id uuid,
  target_branch_id uuid,
  expires_hours integer default 72
)
returns public.access_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_invitation public.access_invitations%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if invite_role not in ('superadmin', 'organization_admin', 'branch_admin', 'dispatcher', 'cashier', 'support', 'analyst')
  then raise exception 'Invalid role'; end if;
  if invite_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Invalid email address'; end if;
  if expires_hours not between 1 and 720 then raise exception 'Expiry must be between 1 and 720 hours'; end if;
  if invite_role = 'superadmin' then
    if not public.is_superadmin() then raise exception 'Permission denied'; end if;
    if target_organization_id is not null or target_branch_id is not null then raise exception 'Superadmin invitations cannot have organization scope'; end if;
  else
    if target_organization_id is null then raise exception 'Organization is required'; end if;
    if not public.has_permission('memberships.manage', target_organization_id, target_branch_id)
    then raise exception 'Permission denied'; end if;
    if target_branch_id is not null and not exists (select 1 from public.branches where id = target_branch_id and organization_id = target_organization_id)
    then raise exception 'Branch is outside the organization'; end if;
  end if;
  insert into public.access_invitations (email, role, organization_id, branch_id, token_hash, invited_by, expires_at)
  values (
    lower(trim(invite_email)), invite_role, target_organization_id, target_branch_id,
    encode(sha256(convert_to(gen_random_uuid()::text || ':' || clock_timestamp()::text, 'UTF8')), 'hex'),
    caller, now() + make_interval(hours => expires_hours)
  ) returning * into new_invitation;
  return new_invitation;
end;
$$;

create or replace function public.transition_settlement_status(
  target_settlement_id uuid,
  next_status text,
  change_reason text default null
)
returns public.settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_settlement public.settlements%rowtype;
begin
  if caller is null or not public.is_superadmin() then raise exception 'Permission denied'; end if;
  select * into strict current_settlement from public.settlements where id = target_settlement_id for update;
  if not (
    (current_settlement.status = 'draft' and next_status in ('review', 'held')) or
    (current_settlement.status = 'review' and next_status in ('draft', 'approved', 'held')) or
    (current_settlement.status = 'approved' and next_status in ('processing', 'held')) or
    (current_settlement.status = 'processing' and next_status in ('paid', 'held')) or
    (current_settlement.status = 'held' and next_status = 'review')
  ) then raise exception 'Invalid settlement status transition'; end if;
  if next_status = 'held' and length(trim(coalesce(change_reason, ''))) < 4
  then raise exception 'A hold reason is required'; end if;
  update public.settlements
  set status = next_status,
      approved_by = case when next_status = 'approved' then caller else approved_by end,
      approved_at = case when next_status = 'approved' then now() else approved_at end,
      updated_at = now()
  where id = target_settlement_id returning * into current_settlement;
  insert into public.audit_events (actor_id, organization_id, entity_type, entity_id, action, reason, metadata)
  values (caller, current_settlement.organization_id, 'settlement', current_settlement.id::text,
    'settlement.status_changed', nullif(trim(coalesce(change_reason, '')), ''),
    jsonb_build_object('status', next_status, 'mock', true, 'transferred_real_money', false));
  return current_settlement;
end;
$$;

insert into public.permissions (code, domain, description, risk_level) values
  ('dashboard.read', 'dashboard', 'Read scoped operational dashboard', 'standard'),
  ('bookings.read', 'bookings', 'Read scoped bookings', 'sensitive'),
  ('bookings.manage', 'bookings', 'Reschedule or cancel scoped bookings', 'sensitive'),
  ('trips.read', 'trips', 'Read scoped trips and manifests', 'standard'),
  ('trips.manage', 'trips', 'Assign resources and transition trip status', 'high'),
  ('schedules.manage', 'schedules', 'Manage routes and schedules', 'high'),
  ('fleet.manage', 'fleet', 'Manage vehicles, drivers, and documents', 'high'),
  ('payments.read', 'finance', 'Read scoped payments', 'sensitive'),
  ('refunds.create', 'finance', 'Create refund requests', 'high'),
  ('refunds.approve', 'finance', 'Approve refund requests', 'high'),
  ('customers.read', 'customers', 'Read support-safe customer information', 'sensitive'),
  ('promotions.manage', 'promotions', 'Manage promotion lifecycle', 'high'),
  ('support.manage', 'support', 'Manage scoped support cases', 'sensitive'),
  ('reports.read', 'reports', 'Read scoped reports', 'standard'),
  ('reports.export', 'reports', 'Export scoped reports', 'sensitive'),
  ('settings.manage', 'settings', 'Manage scoped settings', 'high'),
  ('memberships.manage', 'access', 'Manage scoped staff access', 'high'),
  ('platform.manage', 'platform', 'Manage platform-wide governance', 'high'),
  ('audit.read', 'audit', 'Read audit events', 'sensitive')
on conflict (code) do update set domain = excluded.domain, description = excluded.description, risk_level = excluded.risk_level;

insert into public.role_permissions (role, permission_code)
select role_name, permission_code from (values
  ('organization_admin', 'dashboard.read'), ('organization_admin', 'bookings.read'), ('organization_admin', 'bookings.manage'),
  ('organization_admin', 'trips.read'), ('organization_admin', 'trips.manage'), ('organization_admin', 'schedules.manage'),
  ('organization_admin', 'fleet.manage'), ('organization_admin', 'payments.read'), ('organization_admin', 'refunds.create'),
  ('organization_admin', 'refunds.approve'), ('organization_admin', 'customers.read'), ('organization_admin', 'promotions.manage'),
  ('organization_admin', 'support.manage'), ('organization_admin', 'reports.read'), ('organization_admin', 'reports.export'),
  ('organization_admin', 'settings.manage'), ('organization_admin', 'memberships.manage'), ('organization_admin', 'audit.read'),
  ('branch_admin', 'dashboard.read'), ('branch_admin', 'bookings.read'), ('branch_admin', 'bookings.manage'),
  ('branch_admin', 'trips.read'), ('branch_admin', 'trips.manage'), ('branch_admin', 'schedules.manage'),
  ('branch_admin', 'fleet.manage'), ('branch_admin', 'payments.read'), ('branch_admin', 'refunds.create'),
  ('branch_admin', 'customers.read'), ('branch_admin', 'promotions.manage'), ('branch_admin', 'support.manage'),
  ('branch_admin', 'reports.read'), ('branch_admin', 'settings.manage'), ('branch_admin', 'memberships.manage'),
  ('dispatcher', 'dashboard.read'), ('dispatcher', 'bookings.read'), ('dispatcher', 'trips.read'), ('dispatcher', 'trips.manage'),
  ('cashier', 'dashboard.read'), ('cashier', 'bookings.read'), ('cashier', 'bookings.manage'), ('cashier', 'payments.read'), ('cashier', 'refunds.create'),
  ('support', 'dashboard.read'), ('support', 'bookings.read'), ('support', 'customers.read'), ('support', 'support.manage'),
  ('analyst', 'dashboard.read'), ('analyst', 'bookings.read'), ('analyst', 'trips.read'), ('analyst', 'payments.read'), ('analyst', 'reports.read'), ('analyst', 'reports.export')
) grants(role_name, permission_code)
on conflict do nothing;

insert into public.platform_settings (key, value) values
  ('booking_policy', '{"seat_hold_minutes":10,"max_passengers":8,"currency":"PHP"}'::jsonb),
  ('notification_defaults', '{"booking_confirmation":["email","sms"],"departure_reminder":["email","sms"],"trip_disruption":["sms"]}'::jsonb)
on conflict (key) do nothing;

-- The first real Admin account needs an organization scope. These are
-- production defaults, not passenger/demo transactions, and are safe to rerun.
insert into public.organizations (name, slug, legal_name, status, timezone)
values ('VanGO Transport', 'vango-transport', 'VanGO Transport', 'active', 'Asia/Manila')
on conflict (slug) do update
set name = excluded.name,
    legal_name = coalesce(public.organizations.legal_name, excluded.legal_name),
    status = 'active';

insert into public.branches (organization_id, name, code, timezone, status)
select id, 'Main Operations', 'MAIN', 'Asia/Manila', 'active'
from public.organizations where slug = 'vango-transport'
on conflict (organization_id, code) do update
set name = excluded.name,
    status = 'active';

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','organizations','branches','permissions','role_permissions','memberships','membership_permissions',
    'access_invitations','access_reviews','terminals','routes','schedule_rules','schedule_exceptions','vehicles','drivers',
    'compliance_requirements','compliance_documents','trips','trip_assignments','trip_seats','promotions','bookings',
    'seat_holds','booking_quotes','booking_passengers','promotion_redemptions','payment_intents','payment_events','refunds',
    'settlements','settlement_items','support_cases','support_messages','notifications','notification_deliveries',
    'branch_settings','platform_settings','system_bootstrap_state','integration_connections','webhook_deliveries','incidents','audit_events'
  ]
  loop execute format('alter table public.%I enable row level security', table_name); end loop;
end;
$$;

drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_superadmin());
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists organizations_scoped_select on public.organizations;
create policy organizations_scoped_select on public.organizations for select to authenticated using (public.can_access_organization(id));
drop policy if exists organizations_superadmin_all on public.organizations;
create policy organizations_superadmin_all on public.organizations for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists branches_scoped_select on public.branches;
create policy branches_scoped_select on public.branches for select to authenticated using (public.can_access_branch(organization_id, id));
drop policy if exists branches_superadmin_all on public.branches;
create policy branches_superadmin_all on public.branches for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists membership_own_or_admin_select on public.memberships;
create policy membership_own_or_admin_select on public.memberships for select to authenticated using (user_id = auth.uid() or public.can_access_organization(organization_id));
drop policy if exists membership_admin_all on public.memberships;
create policy membership_admin_all on public.memberships for all to authenticated using (public.is_superadmin() or public.has_permission('memberships.manage', organization_id, branch_id)) with check (public.is_superadmin() or public.has_permission('memberships.manage', organization_id, branch_id));

drop policy if exists permission_authenticated_select on public.permissions;
create policy permission_authenticated_select on public.permissions for select to authenticated using (true);
drop policy if exists role_permission_authenticated_select on public.role_permissions;
create policy role_permission_authenticated_select on public.role_permissions for select to authenticated using (true);
drop policy if exists permission_superadmin_all on public.permissions;
create policy permission_superadmin_all on public.permissions for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists role_permission_superadmin_all on public.role_permissions;
create policy role_permission_superadmin_all on public.role_permissions for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists membership_permissions_scoped_select on public.membership_permissions;
create policy membership_permissions_scoped_select on public.membership_permissions for select to authenticated using (
  exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and (m.user_id = auth.uid() or public.can_access_organization(m.organization_id))
  )
);
drop policy if exists membership_permissions_scoped_manage on public.membership_permissions;
create policy membership_permissions_scoped_manage on public.membership_permissions for all to authenticated using (
  exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and (public.is_superadmin() or public.has_permission('memberships.manage', m.organization_id, m.branch_id))
  )
) with check (
  exists (
    select 1 from public.memberships m
    where m.id = membership_id
      and (public.is_superadmin() or public.has_permission('memberships.manage', m.organization_id, m.branch_id))
  )
);

drop policy if exists access_invitations_scoped_all on public.access_invitations;
create policy access_invitations_scoped_all on public.access_invitations for all to authenticated using (
  public.is_superadmin() or (
    organization_id is not null and public.has_permission('memberships.manage', organization_id, branch_id)
  )
) with check (
  public.is_superadmin() or (
    organization_id is not null and public.has_permission('memberships.manage', organization_id, branch_id)
  )
);
drop policy if exists access_reviews_scoped_all on public.access_reviews;
create policy access_reviews_scoped_all on public.access_reviews for all to authenticated using (
  public.is_superadmin() or (
    organization_id is not null and public.has_permission('memberships.manage', organization_id, branch_id)
  )
) with check (
  public.is_superadmin() or (
    organization_id is not null and public.has_permission('memberships.manage', organization_id, branch_id)
  )
);

drop policy if exists terminals_public_select on public.terminals;
create policy terminals_public_select on public.terminals for select to anon, authenticated using (is_active);
drop policy if exists terminals_superadmin_all on public.terminals;
create policy terminals_superadmin_all on public.terminals for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists routes_public_select on public.routes;
create policy routes_public_select on public.routes for select to anon using (status = 'published');
drop policy if exists routes_passenger_select on public.routes;
create policy routes_passenger_select on public.routes for select to authenticated using (
  status = 'published' and not public.has_active_staff_membership()
);
drop policy if exists routes_scoped_select on public.routes;
create policy routes_scoped_select on public.routes for select to authenticated using (
  public.has_permission('schedules.manage', organization_id)
  or public.has_permission('trips.read', organization_id)
);
drop policy if exists routes_staff_all on public.routes;
create policy routes_staff_all on public.routes for all to authenticated using (public.has_permission('schedules.manage', organization_id)) with check (public.has_permission('schedules.manage', organization_id));

drop policy if exists trips_public_select on public.trips;
create policy trips_public_select on public.trips for select to anon using (status in ('scheduled','ready','boarding'));
drop policy if exists trips_passenger_select on public.trips;
create policy trips_passenger_select on public.trips for select to authenticated using (
  status in ('scheduled','ready','boarding') and not public.has_active_staff_membership()
);
drop policy if exists trips_scoped_select on public.trips;
create policy trips_scoped_select on public.trips for select to authenticated using (
  public.has_permission('trips.read', organization_id, branch_id)
  or public.has_permission('trips.manage', organization_id, branch_id)
);
drop policy if exists trips_staff_all on public.trips;
create policy trips_staff_all on public.trips for all to authenticated using (public.has_permission('trips.manage', organization_id, branch_id)) with check (public.has_permission('trips.manage', organization_id, branch_id));

drop policy if exists trip_seats_public_select on public.trip_seats;
create policy trip_seats_public_select on public.trip_seats for select to authenticated using (
  exists (
    select 1 from public.trips t
    where t.id = trip_id
      and (
        (t.status in ('scheduled','ready','boarding') and not public.has_active_staff_membership())
        or public.can_access_branch(t.organization_id, t.branch_id)
      )
  )
);
drop policy if exists trip_seats_staff_all on public.trip_seats;
create policy trip_seats_staff_all on public.trip_seats for all to authenticated using (exists (select 1 from public.trips t where t.id = trip_id and public.has_permission('trips.manage', t.organization_id, t.branch_id))) with check (exists (select 1 from public.trips t where t.id = trip_id and public.has_permission('trips.manage', t.organization_id, t.branch_id)));

drop policy if exists schedule_exceptions_scoped_all on public.schedule_exceptions;
create policy schedule_exceptions_scoped_all on public.schedule_exceptions for all to authenticated using (
  exists (
    select 1 from public.schedule_rules sr
    where sr.id = schedule_rule_id
      and public.has_permission('schedules.manage', sr.organization_id, sr.branch_id)
  )
) with check (
  exists (
    select 1 from public.schedule_rules sr
    where sr.id = schedule_rule_id
      and public.has_permission('schedules.manage', sr.organization_id, sr.branch_id)
  )
);

drop policy if exists trip_assignments_scoped_all on public.trip_assignments;
create policy trip_assignments_scoped_all on public.trip_assignments for all to authenticated using (
  exists (
    select 1 from public.trips t
    where t.id = trip_id
      and public.has_permission('trips.manage', t.organization_id, t.branch_id)
  )
) with check (
  exists (
    select 1 from public.trips t
    where t.id = trip_id
      and public.has_permission('trips.manage', t.organization_id, t.branch_id)
  )
);

drop policy if exists compliance_requirements_authenticated_select on public.compliance_requirements;
create policy compliance_requirements_authenticated_select on public.compliance_requirements for select to authenticated using (true);
drop policy if exists compliance_requirements_superadmin_all on public.compliance_requirements;
create policy compliance_requirements_superadmin_all on public.compliance_requirements for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists compliance_documents_scoped_select on public.compliance_documents;
create policy compliance_documents_scoped_select on public.compliance_documents for select to authenticated using (
  public.is_superadmin() or public.can_access_branch(organization_id, branch_id)
);
drop policy if exists compliance_documents_scoped_all on public.compliance_documents;
create policy compliance_documents_scoped_all on public.compliance_documents for all to authenticated using (
  public.is_superadmin() or public.has_permission('fleet.manage', organization_id, branch_id)
) with check (
  public.is_superadmin() or public.has_permission('fleet.manage', organization_id, branch_id)
);

drop policy if exists seat_holds_own_select on public.seat_holds;
create policy seat_holds_own_select on public.seat_holds for select to authenticated using (user_id = auth.uid());
drop policy if exists booking_quotes_own_select on public.booking_quotes;
create policy booking_quotes_own_select on public.booking_quotes for select to authenticated using (user_id = auth.uid());

drop policy if exists bookings_own_or_scoped_select on public.bookings;
create policy bookings_own_or_scoped_select on public.bookings for select to authenticated using (user_id = auth.uid() or public.has_permission('bookings.read', organization_id, branch_id));
drop policy if exists bookings_staff_update on public.bookings;
create policy bookings_staff_update on public.bookings for update to authenticated using (public.has_permission('bookings.manage', organization_id, branch_id)) with check (public.has_permission('bookings.manage', organization_id, branch_id));

drop policy if exists booking_passengers_own_or_scoped_select on public.booking_passengers;
create policy booking_passengers_own_or_scoped_select on public.booking_passengers for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and (b.user_id = auth.uid() or public.has_permission('bookings.read', b.organization_id, b.branch_id))));

drop policy if exists promotion_redemptions_own_or_scoped_select on public.promotion_redemptions;
create policy promotion_redemptions_own_or_scoped_select on public.promotion_redemptions for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and public.has_permission('bookings.read', b.organization_id, b.branch_id)
  )
);

drop policy if exists payments_own_or_scoped_select on public.payment_intents;
create policy payments_own_or_scoped_select on public.payment_intents for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and (b.user_id = auth.uid() or public.has_permission('payments.read', b.organization_id, b.branch_id))));
drop policy if exists refunds_own_or_scoped_select on public.refunds;
create policy refunds_own_or_scoped_select on public.refunds for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and (b.user_id = auth.uid() or public.has_permission('payments.read', b.organization_id, b.branch_id))));

drop policy if exists payment_events_own_or_scoped_select on public.payment_events;
create policy payment_events_own_or_scoped_select on public.payment_events for select to authenticated using (
  exists (
    select 1
    from public.payment_intents pi
    join public.bookings b on b.id = pi.booking_id
    where pi.id = payment_intent_id
      and (b.user_id = auth.uid() or public.has_permission('payments.read', b.organization_id, b.branch_id))
  )
);

drop policy if exists settlements_scoped_select on public.settlements;
create policy settlements_scoped_select on public.settlements for select to authenticated using (
  public.is_superadmin() or public.has_permission('payments.read', organization_id)
);
drop policy if exists settlements_superadmin_all on public.settlements;
create policy settlements_superadmin_all on public.settlements for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists settlement_items_scoped_select on public.settlement_items;
create policy settlement_items_scoped_select on public.settlement_items for select to authenticated using (
  exists (
    select 1 from public.settlements s
    where s.id = settlement_id
      and (public.is_superadmin() or public.has_permission('payments.read', s.organization_id))
  )
);
drop policy if exists settlement_items_superadmin_all on public.settlement_items;
create policy settlement_items_superadmin_all on public.settlement_items for all to authenticated using (
  public.is_superadmin()
) with check (public.is_superadmin());

drop policy if exists notifications_own_all on public.notifications;
drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notification_deliveries_own_select on public.notification_deliveries;
create policy notification_deliveries_own_select on public.notification_deliveries for select to authenticated using (
  exists (
    select 1 from public.notifications n
    where n.id = notification_id and n.user_id = auth.uid()
  )
);
drop policy if exists support_cases_own_or_scoped_select on public.support_cases;
create policy support_cases_own_or_scoped_select on public.support_cases for select to authenticated using (requester_id = auth.uid() or (organization_id is not null and public.has_permission('support.manage', organization_id, branch_id)) or public.is_superadmin());
drop policy if exists support_cases_own_insert on public.support_cases;
create policy support_cases_own_insert on public.support_cases for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists support_cases_staff_update on public.support_cases;
create policy support_cases_staff_update on public.support_cases for update to authenticated using ((organization_id is not null and public.has_permission('support.manage', organization_id, branch_id)) or public.is_superadmin()) with check ((organization_id is not null and public.has_permission('support.manage', organization_id, branch_id)) or public.is_superadmin());
drop policy if exists support_messages_case_access on public.support_messages;
create policy support_messages_case_access on public.support_messages for select to authenticated using (exists (select 1 from public.support_cases c where c.id = case_id and (c.requester_id = auth.uid() or (c.organization_id is not null and public.has_permission('support.manage', c.organization_id, c.branch_id)) or public.is_superadmin()) and (visibility = 'customer' or c.requester_id <> auth.uid())));
drop policy if exists support_messages_case_insert on public.support_messages;
create policy support_messages_case_insert on public.support_messages for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.support_cases c where c.id = case_id and (c.requester_id = auth.uid() or (c.organization_id is not null and public.has_permission('support.manage', c.organization_id, c.branch_id)) or public.is_superadmin())));

do $$
declare
  item record;
begin
  for item in select * from (values
    ('schedule_rules','organization_id','branch_id','schedules.manage'),
    ('vehicles','organization_id','branch_id','fleet.manage'),
    ('drivers','organization_id','branch_id','fleet.manage'),
    ('promotions','organization_id','branch_id','promotions.manage')
  ) as x(table_name, organization_column, branch_column, permission_code)
  loop
    execute format('drop policy if exists scoped_staff_all on public.%I', item.table_name);
    execute format(
      'create policy scoped_staff_all on public.%I for all to authenticated using (public.has_permission(%L, %I, %I)) with check (public.has_permission(%L, %I, %I))',
      item.table_name, item.permission_code, item.organization_column, item.branch_column,
      item.permission_code, item.organization_column, item.branch_column
    );
  end loop;
end;
$$;

drop policy if exists branch_settings_scoped_select on public.branch_settings;
create policy branch_settings_scoped_select on public.branch_settings for select to authenticated using (
  exists (
    select 1 from public.branches b
    where b.id = branch_id and public.can_access_branch(b.organization_id, b.id)
  )
);
drop policy if exists branch_settings_scoped_all on public.branch_settings;
create policy branch_settings_scoped_all on public.branch_settings for all to authenticated using (
  exists (
    select 1 from public.branches b
    where b.id = branch_id and public.has_permission('settings.manage', b.organization_id, b.id)
  )
) with check (
  exists (
    select 1 from public.branches b
    where b.id = branch_id and public.has_permission('settings.manage', b.organization_id, b.id)
  )
);

drop policy if exists platform_settings_superadmin_all on public.platform_settings;
create policy platform_settings_superadmin_all on public.platform_settings for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists integration_connections_superadmin_all on public.integration_connections;
create policy integration_connections_superadmin_all on public.integration_connections for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists webhook_deliveries_superadmin_select on public.webhook_deliveries;
create policy webhook_deliveries_superadmin_select on public.webhook_deliveries for select to authenticated using (public.is_superadmin());

drop policy if exists incidents_authenticated_select on public.incidents;
drop policy if exists incidents_superadmin_all on public.incidents;
create policy incidents_superadmin_all on public.incidents for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists audit_scoped_select on public.audit_events;
create policy audit_scoped_select on public.audit_events for select to authenticated using (public.is_superadmin() or (organization_id is not null and public.has_permission('audit.read', organization_id, branch_id)));

-- Tables without a direct client mutation policy remain service-role/RPC only.
-- This includes mock-payment events, notification deliveries, and audit insertion.

-- Seat inventory is generated by the database so a trip created from the Admin
-- console is immediately bookable by passengers. Four seats per lettered row.
create or replace function public.sync_trip_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seat_letters constant text[] := array['A', 'B', 'C', 'D'];
begin
  insert into public.trip_seats (trip_id, seat_code, seat_class, is_accessibility)
  select
    new.id,
    ((seat_index - 1) / 4 + 1)::text || seat_letters[(seat_index - 1) % 4 + 1],
    'standard',
    seat_index <= 2
  from generate_series(1, new.capacity) as seat_index
  on conflict (trip_id, seat_code) do nothing;

  if tg_op = 'UPDATE' and new.capacity < old.capacity then
    -- Capacity must remain a contiguous 1..N seat map. Reject the reduction
    -- instead of deleting a lower-numbered seat when an out-of-range seat is
    -- sold or actively held.
    if exists (
      select 1
      from public.trip_seats ts
      where ts.trip_id = new.id
        and (
          ((substring(ts.seat_code from '^[0-9]+'))::integer - 1) * 4
          + ascii(right(ts.seat_code, 1)) - ascii('A') + 1
        ) > new.capacity
        and (
          ts.state <> 'available'
          or exists (
            select 1 from public.seat_holds sh
            where sh.trip_seat_id = ts.id
              and sh.status = 'active'
              and sh.expires_at > now()
          )
        )
    ) then
      raise exception 'Capacity cannot remove a sold or actively held seat';
    end if;

    delete from public.trip_seats ts
    where ts.trip_id = new.id
      and (
        ((substring(ts.seat_code from '^[0-9]+'))::integer - 1) * 4
        + ascii(right(ts.seat_code, 1)) - ascii('A') + 1
      ) > new.capacity;
  end if;
  return new;
end;
$$;

drop trigger if exists trips_sync_seats on public.trips;
create trigger trips_sync_seats
after insert or update of capacity on public.trips
for each row execute function public.sync_trip_seats();

-- Every staff mutation made straight against a table is audited in the database,
-- so the audit trail cannot be skipped by a client that talks to PostgREST.
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_json jsonb;
  safe_old jsonb;
begin
  -- NEW is absent on DELETE, so pick the surviving row explicitly.
  if tg_op = 'DELETE' then record_json := to_jsonb(old); else record_json := to_jsonb(new); end if;
  safe_old := case
    when tg_op = 'UPDATE' then to_jsonb(old) - array[
      'secret_reference', 'token_hash', 'value', 'mobile_e164', 'support_mobile_e164'
    ]::text[]
    else '{}'::jsonb
  end;

  insert into public.audit_events (
    actor_id, organization_id, branch_id, entity_type, entity_id, action, metadata
  ) values (
    auth.uid(),
    nullif(record_json ->> 'organization_id', '')::uuid,
    nullif(record_json ->> 'branch_id', '')::uuid,
    tg_table_name,
    coalesce(record_json ->> 'id', record_json ->> 'key', record_json ->> 'code', ''),
    tg_table_name || '.' || lower(tg_op),
    case when tg_op = 'UPDATE' then jsonb_build_object('before', safe_old) else '{}'::jsonb end
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

do $$
declare
  audited text;
begin
  foreach audited in array array[
    'organizations', 'branches', 'memberships', 'routes', 'trip_assignments',
    'schedule_rules', 'vehicles', 'drivers', 'promotions', 'compliance_documents',
    'branch_settings', 'platform_settings', 'integration_connections', 'incidents'
  ]
  loop
    execute format('drop trigger if exists %I_audit on public.%I', audited, audited);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.log_audit_event()',
      audited, audited
    );
  end loop;

  -- Booking confirmation only updates seats_sold/inventory_version, so it does
  -- not trigger the scoped update audit below. Operational changes still do.
  drop trigger if exists trips_audit on public.trips;
  create trigger trips_audit
  after insert or delete on public.trips
  for each row execute function public.log_audit_event();

  drop trigger if exists trips_audit_update on public.trips;
  create trigger trips_audit_update
  after update of organization_id, branch_id, route_id, schedule_rule_id,
    departure_at, arrival_at, capacity, fare, status, gate
  on public.trips
  for each row execute function public.log_audit_event();
end;
$$;

-- Realtime: passenger, Admin, and Superadmin sessions observe the same rows.
-- Row Level Security still filters every change event per subscriber.
do $$
declare
  streamed text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach streamed in array array[
    'organizations', 'branches', 'memberships', 'terminals', 'routes', 'trips',
    'trip_seats', 'seat_holds', 'trip_assignments', 'vehicles', 'drivers', 'promotions',
    'bookings', 'booking_passengers', 'payment_intents', 'refunds', 'support_cases',
    'support_messages', 'notifications', 'incidents', 'audit_events'
  ]
  loop
    -- Full replica identity lets Realtime evaluate RLS on updates and deletes.
    execute format('alter table public.%I replica identity full', streamed);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = streamed
    ) then
      execute format('alter publication supabase_realtime add table public.%I', streamed);
    end if;
  end loop;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.terminals, public.routes, public.trips to anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update on public.profiles, public.notifications to authenticated;
grant insert, update, delete on public.memberships, public.membership_permissions,
  public.access_invitations, public.access_reviews, public.organizations, public.branches,
  public.routes, public.trips, public.trip_assignments, public.trip_seats,
  public.schedule_rules, public.schedule_exceptions, public.vehicles, public.drivers,
  public.compliance_requirements, public.compliance_documents, public.promotions,
  public.support_cases, public.support_messages, public.branch_settings,
  public.platform_settings, public.integration_connections, public.incidents to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_trip_seats() from public, anon, authenticated;
revoke all on function public.log_audit_event() from public, anon, authenticated;
revoke all on function public.is_superadmin() from public, anon, authenticated;
revoke all on function public.has_active_staff_membership() from public, anon, authenticated;
revoke all on function public.can_access_organization(uuid) from public, anon, authenticated;
revoke all on function public.can_access_branch(uuid, uuid) from public, anon, authenticated;
revoke all on function public.has_permission(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_my_context() from public, anon, authenticated;
revoke all on function public.search_available_trips(uuid, uuid, date, integer) from public, anon, authenticated;
revoke all on function public.hold_trip_seats(uuid, text[], integer) from public, anon, authenticated;
revoke all on function public.get_trip_seat_map(uuid) from public, anon, authenticated;
revoke all on function public.release_seat_hold(uuid) from public, anon, authenticated;
revoke all on function public.quote_booking(uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_booking(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.complete_mock_payment(uuid) from public, anon, authenticated;
revoke all on function public.transition_trip_status(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.request_refund(uuid, text) from public, anon, authenticated;
revoke all on function public.assign_trip_resources(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.create_support_case(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.transition_refund_status(uuid, text, text) from public, anon, authenticated;
revoke all on function public.review_compliance_document(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_branch_setting(uuid, text, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.set_platform_setting(text, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.create_access_invitation(text, text, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.transition_settlement_status(uuid, text, text) from public, anon, authenticated;

grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.has_active_staff_membership() to authenticated;
grant execute on function public.can_access_organization(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid, uuid) to authenticated;
grant execute on function public.has_permission(text, uuid, uuid) to authenticated;
grant execute on function public.resolve_my_context() to authenticated;
grant execute on function public.search_available_trips(uuid, uuid, date, integer) to anon, authenticated;
grant execute on function public.hold_trip_seats(uuid, text[], integer) to authenticated;
grant execute on function public.get_trip_seat_map(uuid) to authenticated;
grant execute on function public.release_seat_hold(uuid) to authenticated;
grant execute on function public.quote_booking(uuid, text) to authenticated;
grant execute on function public.confirm_booking(uuid, jsonb) to authenticated;
grant execute on function public.complete_mock_payment(uuid) to authenticated;
grant execute on function public.transition_trip_status(uuid, text, bigint, text) to authenticated;
grant execute on function public.request_refund(uuid, text) to authenticated;
grant execute on function public.assign_trip_resources(uuid, uuid, uuid, bigint) to authenticated;
grant execute on function public.create_support_case(uuid, text, text, text, text) to authenticated;
grant execute on function public.transition_refund_status(uuid, text, text) to authenticated;
grant execute on function public.review_compliance_document(uuid, text, text) to authenticated;
grant execute on function public.set_branch_setting(uuid, text, jsonb, bigint) to authenticated;
grant execute on function public.set_platform_setting(text, jsonb, bigint) to authenticated;
grant execute on function public.create_access_invitation(text, text, uuid, uuid, integer) to authenticated;
grant execute on function public.transition_settlement_status(uuid, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('compliance-documents', 'compliance-documents', false, 10485760, array['application/pdf','image/jpeg','image/png']),
  ('tickets', 'tickets', false, 5242880, array['application/pdf']),
  ('exports', 'exports', false, 52428800, array['text/csv','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
drop policy if exists avatars_own_write on storage.objects;
create policy avatars_own_write on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and owner_id = auth.uid()::text) with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);
drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and owner_id = auth.uid()::text);
drop policy if exists compliance_scoped_read on storage.objects;
create policy compliance_scoped_read on storage.objects for select to authenticated using (bucket_id = 'compliance-documents' and (public.is_superadmin() or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active' and m.organization_id::text = (storage.foldername(name))[1])));
drop policy if exists compliance_scoped_write on storage.objects;
create policy compliance_scoped_write on storage.objects for insert to authenticated with check (bucket_id = 'compliance-documents' and (public.is_superadmin() or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active' and m.organization_id::text = (storage.foldername(name))[1] and m.role in ('organization_admin','branch_admin'))));
drop policy if exists compliance_scoped_delete on storage.objects;
create policy compliance_scoped_delete on storage.objects for delete to authenticated using (bucket_id = 'compliance-documents' and (public.is_superadmin() or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active' and m.organization_id::text = (storage.foldername(name))[1] and m.role in ('organization_admin','branch_admin'))));

commit;

-- First Superadmin bootstrap (run separately after creating the user in Supabase Auth):
-- insert into public.memberships (user_id, role, status)
-- values ('PASTE_AUTH_USER_UUID_HERE', 'superadmin', 'active');
