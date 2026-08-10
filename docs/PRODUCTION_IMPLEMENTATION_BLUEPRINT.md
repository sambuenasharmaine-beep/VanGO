# VanGO Production Implementation Blueprint

Status: authoritative conversion plan  
Scope: Passenger, Admin, and Superadmin web application  
Target runtime: Vercel with Supabase Auth, PostgreSQL, Realtime, and Storage  
Current deployment state: local only; production deployment remains deferred

## 1. Product Decision

VanGO must operate as one application with one authentication system and three permission-scoped experiences. The public site must never expose a workspace picker that lets a visitor open Admin or Superadmin directly.

The new entry flow is:

1. `/` opens the real passenger booking search experience.
2. Anonymous visitors can search published routes and trips.
3. Authentication is required before a seat hold, checkout, booking history, or profile update.
4. `/login` authenticates through Supabase Auth.
5. After authentication, the server resolves the user's active membership and redirects automatically:
   - passenger with no staff membership → `/passenger`
   - branch or organization staff → `/admin`
   - platform Superadmin → `/superadmin`
6. A user never chooses or claims a privileged role from the browser.
7. Direct access to unauthorized routes is rejected server-side and by PostgreSQL Row Level Security.

The current `Choose your workspace` section, direct Admin/Superadmin links, demo credentials, `Supabase-ready` wording, and fake service-health claims must be removed.

## 2. Current-State Findings

| Surface | Current behavior | Required production behavior |
|---|---|---|
| Homepage | Public role selector links directly to all workspaces | Passenger search/home only; staff access through sign-in |
| Login | Prefilled demo credentials and a link back to `/` | Supabase email/password session, validation, errors, recovery, callback |
| Route security | Admin and Superadmin pages are public | Server guard plus database-enforced role and tenant scope |
| Passenger search | Fixed origin, destination, date, and seats | Search active terminals and published trips from PostgreSQL |
| Seat selection | In-memory occupied/reserved sets | Expiring transactional seat holds with concurrency protection |
| Checkout | Prefilled sample passengers | Validated booking draft, authoritative quote, and one mock-payment confirmation |
| Ticket | Static booking reference | Booking-owned ticket loaded from the database |
| Admin modules | Hardcoded tables and non-mutating buttons | Scoped queries and audited mutations |
| Superadmin modules | Hardcoded platform metrics and status | Platform queries, privileged actions, audit, and observability |
| Supabase | Browser helper and initial migration only | Auth cookies, server client, complete migrations, RLS, RPCs, Storage |
| Payments | Visual GCash/Maya/Card choices | Single mock-payment action, idempotent confirmation, and explicit no-real-charge disclosure |

## 3. Route and Access Architecture

### Public and passenger routes

| Route | Access | Responsibility |
|---|---|---|
| `/` | Public | Search form, featured destinations, service information |
| `/login` | Public-only | Sign in; redirect authenticated users by role |
| `/login?mode=register` | Public-only | Passenger account registration and verification |
| `/login?mode=forgot` | Public-only | Password recovery request |
| `/passenger/trips` | Public | Display current published trip availability |
| `/passenger/seats` | Passenger | Create, refresh, change, or release a seat hold |
| `/passenger/checkout` | Passenger | Passenger details, quote review, and explicit mock-payment confirmation |
| `/passenger/bookings` | Passenger | Read only the signed-in passenger's bookings |
| `/passenger/ticket?reference=<reference>` | Passenger | Signed-in passenger's booking details and mock-payment state |
| `/passenger/profile` | Passenger | Own profile only |
| `/passenger/alerts` | Passenger | Own notifications only |

### Admin routes

All `/admin/**` routes require an active staff membership. Organization and branch scope is resolved on the server; it is not accepted from an untrusted browser field.

| Role | Default scope | Main permissions |
|---|---|---|
| `organization_admin` | One organization | All branches, staff, operations, finance summaries, settings |
| `branch_admin` | One branch | Branch bookings, trips, schedules, fleet, customers, support |
| `dispatcher` | One branch | Trips, manifests, assignments, boarding, status transitions |
| `cashier` | One branch | Counter bookings, payments, permitted refunds |
| `support` | Assigned scope | Bookings and support cases with limited passenger data |
| `analyst` | Assigned scope | Read-only reports and approved exports |

### Superadmin routes

All `/superadmin/**` routes require an active platform membership with `superadmin`. Platform-wide actions require explicit permission checks. Sensitive booking reads, exports, impersonation, organization suspension, settlement approval, and configuration publication must create audit events.

### Route guard behavior

- Anonymous protected request → `/login?returnTo=<safe-relative-path>`.
- Passenger requests Admin/Superadmin → `/passenger` plus access-denied message.
- Admin requests Superadmin → `/admin` plus access-denied message.
- Suspended membership → dedicated suspended-access screen; do not silently downgrade.
- No active membership → passenger scope only.
- Authorization is repeated in every server mutation and protected query; hiding navigation is not security.

## 4. Supabase Client Boundaries

| Client | Credential | Allowed use |
|---|---|---|
| Browser client | Publishable key | Auth session, public searches, user-owned/scoped reads protected by RLS |
| Server session client | Publishable key plus user cookie | Protected server rendering and user-attributed mutations |
| Service client | Service-role key, server only | Optional scheduled jobs and controlled administration; never mock checkout |

Requirements:

- Add the Supabase server-rendering session package and cookie integration.
- Never expose the service-role key in browser bundles.
- Never trust `role`, `organization_id`, `branch_id`, price, discount, seat availability, or payment status from the client.
- RLS remains enabled for ordinary traffic even when application route guards exist.
- Separate development, staging, and production Supabase projects.

## 5. Database Schema

The existing `profiles`, `organizations`, `branches`, `memberships`, `terminals`, `routes`, `trips`, `bookings`, `booking_passengers`, and `audit_events` tables remain the foundation. They require the following production additions.

### Identity and authorization

| Table | Essential fields | Purpose |
|---|---|---|
| `profiles` | auth user id, full name, verified mobile, account status | Application profile mapped 1:1 to Supabase Auth |
| `memberships` | user, role, organization, branch, status, valid dates | Tenant-scoped staff assignment |
| `permissions` | code, domain, risk level | Stable permission catalog |
| `role_permissions` | role, permission | Permission grants per role |
| `membership_permissions` | membership, permission, allow/deny | Exceptional direct override |
| `access_invitations` | email, role, scope, token hash, expiry, status | Controlled staff onboarding |
| `access_reviews` | reviewer, scope, due date, result | Periodic privileged-access review |

Passwords and provider identities stay exclusively in Supabase Auth.

### Routes, schedules, fleet, and seats

| Table | Essential fields | Purpose |
|---|---|---|
| `terminals` | name, city, address, coordinates, active state | Canonical public terminal directory |
| `routes` | organization, origin, destination, duration, base fare, status | Operator route definition |
| `schedule_rules` | route, branch, weekdays, departure time, effective dates, fare, capacity | Recurring service template |
| `schedule_exceptions` | rule, service date, override/cancel state, reason | Holiday and one-off schedule changes |
| `vehicles` | organization, branch, plate, model, capacity, status | Fleet registry |
| `drivers` | organization, branch, profile/contact fields, status | Driver registry without auth coupling |
| `vehicle_documents` | vehicle, type, expiry, storage path, review state | Vehicle compliance |
| `driver_documents` | driver, type, expiry, storage path, review state | Driver compliance |
| `trip_assignments` | trip, vehicle, driver, assigned by, version | Conflict-safe dispatch assignment |
| `trip_seats` | trip, seat code, seat class, accessibility flag, state, version | Authoritative trip inventory |
| `seat_holds` | trip seat, user, token hash, expiry, status | Short-lived passenger reservation |

Constraints prevent double assignment of an active vehicle, driver, or seat during overlapping service windows.

### Booking and finance

| Table | Essential fields | Purpose |
|---|---|---|
| `booking_quotes` | user, trip, fare breakdown, rule versions, expiry | Server-calculated price snapshot |
| `bookings` | reference, user, trip, scope, status, totals, version | Booking aggregate |
| `booking_passengers` | booking, passenger details, seat, eligibility | Passenger manifest records |
| `payment_intents` | booking, mock provider, amount, currency, status, idempotency key | Simulated payment record; database checks reject non-mock providers |
| `payment_events` | mock event id, intent, payload hash, status | Immutable simulated-payment completion record |
| `refunds` | booking/mock payment, amount, reason, status | Simulated refund-request lifecycle; no funds move |
| `promotions` | code, scope, rules, budget, validity, status | Promotion definition |
| `promotion_redemptions` | promotion, user, booking, amount | Enforce limits and attribution |
| `settlements` | organization, period, gross, fees, adjustments, payout, status | Mock operator ledger aggregate only |
| `settlement_items` | settlement, booking/mock payment, amount | Mock reconciliation source lines |

All currency values use fixed-precision decimal fields. Client-computed totals are display-only and never accepted as authoritative.

### Support, notifications, configuration, and governance

| Table | Essential fields | Purpose |
|---|---|---|
| `support_cases` | requester, booking, organization/branch, assignee, priority, status, SLA dates | Support workflow |
| `support_messages` | case, author, visibility, body, attachments | Passenger and staff conversation |
| `notifications` | user, type, channel, payload, read/delivery state | In-app notification inbox |
| `notification_deliveries` | notification, provider, attempts, provider id, result | SMS/email delivery tracking |
| `branch_settings` | branch, key, value, version | Branch-specific configuration |
| `platform_settings` | key, value, version, published by/at | Global defaults |
| `integration_connections` | type, environment, public metadata, status | Provider connection metadata only |
| `webhook_deliveries` | integration, event, destination, attempts, result | Partner webhook observability |
| `compliance_requirements` | entity type, document type, validity rules | Requirement catalog |
| `audit_events` | actor, scope, request id, entity, action, redacted metadata | Append-only accountability |

Provider secrets belong in Supabase/Vercel secrets, never in `integration_connections`.

## 6. Required Database Functions

| Function | Transactional responsibility |
|---|---|
| `resolve_user_context` | Return the authenticated user's profile, memberships, roles, permissions, and valid scopes |
| `search_available_trips` | Return published trips with authoritative availability and current fares |
| `hold_trip_seats` | Lock requested seats, expire prior holds, reject conflicts, return hold expiry |
| `refresh_seat_hold` | Extend only the caller's valid hold within policy |
| `release_seat_hold` | Release only the caller's active hold |
| `quote_booking` | Validate hold and compute fare, fees, discounts, and cancellation terms |
| `confirm_booking` | Atomically consume hold/quote and create the pending booking |
| `complete_mock_payment` | Idempotently record the single simulated payment mode and confirm the booking without contacting a financial provider |
| `transition_trip_status` | Enforce the scheduled → boarding → departed → completed state machine |
| `assign_trip_resources` | Validate vehicle/driver availability and compliance |
| `request_refund` | Calculate eligible refund and create an idempotent workflow |
| `publish_configuration` | Validate version, record change summary, publish, and audit |

Security-definer functions must set a safe search path and validate the authenticated caller and scope internally.

## 7. API and Server Action Contracts

### Authentication and session

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/context`

### Passenger

- `GET /api/terminals?query=`
- `GET /api/trips/search?origin=&destination=&date=&passengers=`
- `POST /api/seat-holds`
- `PATCH /api/seat-holds/:id`
- `DELETE /api/seat-holds/:id`
- `POST /api/booking-quotes`
- `POST /api/bookings`
- `GET /api/bookings`
- `GET /api/bookings/:reference`
- `POST /api/bookings/:reference/cancel`
- `POST /api/payments/mock-complete`
- `GET /api/payments/:id/status` (mock record only)
- `GET /api/tickets/:reference`
- `GET/PATCH /api/profile`
- `GET/PATCH /api/notifications`

### Admin

- Dashboard, booking search/detail, resend ticket, reschedule, cancel, refund
- Trip search/detail, manifest, assignments, and validated status transitions
- Route, schedule, exception, fleet, driver, and compliance management
- Payment/reconciliation reads and permissioned exports
- Customer support-safe view; no broad profile export by default
- Promotion lifecycle and redemption reporting
- Support case assignment, reply, internal note, resolution, and escalation
- Branch setting read/update with version checks

### Superadmin

- Organization onboarding, review, activation, suspension, and reactivation
- Branch and terminal governance
- Invitation, membership, permission, and access-review lifecycle
- Platform booking search with reason-required sensitive access
- Settlement review/approval and platform reconciliation
- Compliance requirement and evidence decisions
- Integration health/configuration metadata and webhook logs
- Audit search/export, system health, incidents, and global configuration publication

Every mutation contract includes authenticated actor, server-resolved scope, idempotency key, input validation, current version, mutation result, and audit correlation ID.

## 8. UI Component Conversion

Presentation components remain reusable, but page-level features own server queries and mutations.

| Current component | Production replacement |
|---|---|
| `SearchCard` | `TripSearchForm` with terminal autocomplete, date rules, passenger count, URL-backed query |
| `SeatSelector` | `LiveSeatMap` bound to seat-hold RPC and Realtime updates |
| `PaymentSelector` | One `MockPaymentDisclosure` and confirmation action; no method picker or financial-provider UI |
| `BookingDirectory` | Server-paginated `BookingTable` with scoped query and detail drawer |
| `OrganizationDirectory` | Server-paginated tenant directory with lifecycle permissions |
| static metrics | Query-backed metric cards with loading, empty, error, and freshness states |
| static status badges | Database status plus timestamp and source |
| non-working buttons | Real forms/actions or removed until their workflow exists |

Required shared production components:

- `AuthProvider`, `SessionBoundary`, `RoleGuard`, `PermissionGuard`
- `AppErrorBoundary`, `LoadingState`, `EmptyState`, `RetryState`, `OfflineBanner`
- `ConfirmDialog`, `ReasonDialog`, `MutationImpactSummary`, `ToastRegion`
- `FormField`, `CurrencyField`, `DateTimeField`, `AsyncSelect`
- `DataTable`, `MobileRecordList`, `Pagination`, `FilterBar`, `ExportMenu`
- `RealtimeFreshness`, `OptimisticConflictNotice`, `AuditTimeline`

## 9. Screen-to-Data Completion Matrix

A page is not complete until it has a real query, real permitted mutations, loading/error/empty states, authorization tests, and responsive behavior.

| Area | Authoritative data | Required real mutations |
|---|---|---|
| Passenger home/search | terminals, routes, trips | search only |
| Passenger seats | trip seats, seat holds | create/refresh/release hold |
| Checkout/payment | quote, booking, mock payment record | confirm booking and complete the disclosed simulation |
| Bookings/ticket | own booking, passengers, payment | cancel/request refund where allowed |
| Admin overview | scoped trips/bookings/payments/support | action queue links |
| Admin bookings | scoped bookings/passengers/payments | resend, reschedule, cancel, refund |
| Admin dispatch | trips, assignments, manifest | assign resources and transition state |
| Admin schedules/fleet | rules, vehicles, drivers, documents | CRUD and assignments |
| Admin payments | mock payment records/events/refunds | simulated refund/reconciliation actions |
| Admin customers | scoped booking-derived passenger view | support-safe notes only |
| Admin promotions | promotions/redemptions | create, pause, end |
| Admin support | cases/messages/assignments | reply, note, assign, resolve, escalate |
| Admin settings | branch settings | versioned update |
| Superadmin organizations/branches | tenants, branches, compliance | onboard, approve, suspend/reactivate |
| Superadmin access | memberships, permissions, invitations | invite, grant/revoke, suspend |
| Superadmin finance | mock payments, mock settlements, mock refunds | review simulated ledger states |
| Superadmin compliance | requirements/evidence | approve/reject/request update |
| Superadmin integrations | connection metadata/deliveries | test, rotate metadata, enable/disable |
| Superadmin audit/health | audit, incidents, delivery metrics | incident acknowledgement/export |
| Superadmin configuration | global settings and overrides | validate and publish version |

## 10. External Service Boundaries

The following cannot be represented as successful until their real service accounts are configured:

- Supabase project and Auth email delivery
- Supabase is the source of truth for the single mock-payment record. Mock checkout never contacts a bank, card network, wallet, or payment provider and never deducts real money.
- SMS provider account and sender identity
- Transactional email provider/domain
- Optional Google OAuth credentials
- Error monitoring and analytics configuration

Until a notification provider is connected, its channel is hidden or explicitly marked unavailable. Payment remains an intentionally simulated mock flow; the UI must never represent it as a real financial charge.

## 11. Migration and Seed Policy

- Remove `app/data.ts` and page-local business-record arrays as each module gains a real query.
- Remove prefilled login and checkout values.
- Keep only synthetic development seeds in a development-only migration/seed file.
- Never seed real passenger names, mobile numbers, emails, payment references, or provider credentials.
- Apply versioned migrations to development first, then staging, then production.
- Run RLS tests with anonymous, passenger, each staff role, suspended membership, and Superadmin identities.

## 12. Test and Acceptance Gates

### Authentication and authorization

- Anonymous users cannot open protected pages or call protected APIs.
- Passengers cannot read another passenger's booking, ticket, profile, or notification.
- Admin queries cannot cross assigned organization/branch scope.
- Superadmin-only actions reject all other roles even through direct API calls.
- Suspended users and memberships lose access immediately.

### Booking concurrency

- Two users cannot hold or book the same seat.
- Expired holds return to inventory.
- Refresh, back-button, multiple tabs, and reconnect do not duplicate bookings.
- Server price is used even when client values are altered.
- Repeated mock-payment requests do not duplicate confirmation or simulated refund records.

### Operational reliability

- Trip transitions reject invalid order and stale versions.
- Vehicle/driver conflicts and expired compliance are blocked.
- Every high-risk mutation has an audit record and reason.
- Loading, empty, error, offline, expired-session, and retry states are visible and recoverable.

### Responsive support

- Phone widths: 320, 360, 390, and 430 pixels.
- Tablet widths: 768 and 1024 pixels.
- Windows: 1280×720, 1366×768, 1440×900, and 1920×1080.
- Windows scaling: 100%, 125%, 150%, and 200%.
- Keyboard-only operation, visible focus, screen-reader labels, and 44-pixel touch targets.

## 13. Sequential Delivery Plan

### Phase 1 — Security foundation

1. Configure a development Supabase project and local environment.
2. Complete migrations, indexes, RLS policies, helper functions, and seed references.
3. Add Supabase cookie-based server sessions.
4. Replace the role selector with the passenger homepage.
5. Replace fake login with real registration, login, logout, recovery, and role redirect.
6. Protect Admin/Superadmin routes and server operations.

### Phase 2 — Real passenger booking

1. Terminal and trip search.
2. Transactional seat availability and holds.
3. Server-side booking quote.
4. Booking and passenger creation.
5. Idempotent mock-payment completion with an explicit no-real-charge disclosure.
6. Booking history, detail, ticket, cancellation, refund request, and notifications.

### Phase 3 — Real Admin operations

1. Dashboard, booking directory, booking detail, and dispatch.
2. Schedules/routes, fleet/drivers, assignments, and compliance.
3. Payments/refunds, customers, promotions, support, reports, and settings.

### Phase 4 — Real Superadmin governance

1. Organizations, branches, memberships, roles, and permissions.
2. Platform booking oversight, finance, settlements, and compliance.
3. Support oversight, integrations, audit, health, and configuration.

### Phase 5 — Production readiness

1. End-to-end, RLS, mock-payment idempotency, concurrency, mobile, and Windows testing.
2. Staging migration and data rehearsal.
3. Vercel Preview wired only to staging Supabase.
4. Production environment, callback URLs, webhooks, monitoring, backup, and rollback review.
5. Production deployment only after explicit user approval.

## 14. Required Inputs Before Phase 1 Can Be Activated

1. Development Supabase project URL.
2. Development Supabase publishable key.
3. Authentication decision: email/password initially, with Google either enabled now or deferred.
4. No payment-provider credentials are required or accepted. Checkout must always identify the transaction as a mock payment with no real monetary charge.

No credentials belong in this document, source files, chat screenshots, or committed `.env` files. They must be placed in the ignored local environment and later in scoped Vercel environment variables.

## 15. Definition of Done

VanGO is a working website only when:

- the public workspace chooser and all fake/demo claims are gone;
- users authenticate through Supabase and are redirected by server-resolved role;
- every protected page and mutation is authorized server-side and by RLS;
- passenger search, seat hold, quote, booking, payment state, ticket, and history use persistent data;
- Admin and Superadmin screens query and mutate scoped production records;
- every payment status comes from the database-backed mock flow and is labeled as simulated;
- all critical actions are idempotent, conflict-safe, and audited;
- automated build, type, lint, RLS, authorization, concurrency, and end-to-end tests pass;
- mobile and Windows acceptance coverage passes;
- staging is validated before any production deployment.
