# VanGO Admin and Superadmin UI Architecture Blueprint

## 1. Scope

Extend the completed passenger visual language into two role-gated operational products:

- **Admin Console** — daily branch/operator work: bookings, dispatch, schedules, fleet, drivers, customers, payments, promotions, support, and branch reporting.
- **Superadmin Console** — platform-wide work: organizations, branches, users and access, global finance, compliance, audit, integrations, system health, and configuration.

Both surfaces use the VanGo reference design system already documented in `UI_ARCHITECTURE_BLUEPRINT.md`, while adapting density and navigation for desktop operations. They must be usable on phones, tablets, and Windows desktops at common display scaling levels.

## 2. Target Platform

The target implementation is a TypeScript web application deployed on Vercel with Supabase as the managed data platform.

| Layer | Target | Responsibility |
|---|---|---|
| Web application | Next.js App Router + TypeScript | Passenger, Admin, and Superadmin routes; responsive UI; server-rendered entry points |
| Hosting | Vercel | Preview, staging, and production web deployments; server functions; environment management |
| Database | Supabase Postgres | Transactional source of truth for users, trips, seats, bookings, payments, operations, and audit |
| Identity | Supabase Auth | Passenger and staff authentication, sessions, recovery, and MFA-ready flows |
| Authorization | Postgres RLS + scoped membership tables | Tenant, organization, branch, role, and record-level enforcement |
| Live updates | Supabase Realtime | Dispatch status, manifest, seat inventory, notifications, and operational queues |
| Files | Supabase Storage | Private avatars, eligibility evidence, compliance documents, and generated ticket artifacts |
| Privileged workflows | Database functions + Supabase Edge Functions | Seat holds, booking confirmation, payment webhooks, notifications, and scheduled jobs |

Architecture boundaries:

- Browser code uses only the Supabase project URL and publishable/anonymous key.
- The Supabase service-role key is server-only and must never appear in client bundles, logs, screenshots, or repository files.
- Role and organization access is stored in database membership tables, not trusted solely from editable user metadata.
- Passenger, Admin, and Superadmin may share foundations and domain types, but use separate route groups, layouts, navigation, and permission gates.
- Production, preview/staging, and local development use isolated Supabase environments to prevent preview builds from touching production data.

## 3. Role and Scope Model

| Role | Scope | Primary responsibility |
|---|---|---|
| Superadmin | Entire platform | Governance, tenants, access, platform settings, financial oversight |
| Organization admin | One operator/company | All branches, routes, fleet, staff, and reports within the organization |
| Branch admin | One or more branches | Branch schedules, bookings, staff, inventory, and local reports |
| Dispatcher | Assigned branches/trips | Boarding, manifest, driver/vehicle assignment, live trip status |
| Cashier | Assigned branches | Counter bookings, payment collection, refunds within policy |
| Support agent | Assigned organization | Passenger and booking support with constrained mutation rights |
| Analyst | Assigned organization/branches | Read-only reports and exports |

Permissions are capability-based and separately scoped. UI visibility is a convenience only; every API request must enforce role, permission, organization, and branch scope.

## 4. Shared Visual Direction

- Deep teal (`#0E4D64`) structures side navigation, headers, selection, and high-trust operational surfaces.
- Amber (`#F59E0B`) is reserved for the single primary action within the current work context.
- White cards sit on the canvas (`#F6F7F9`) with 1px borders and restrained shadows.
- Plus Jakarta Sans is used for titles and actions; Inter for body and labels; JetBrains Mono for references, plates, times, fares, counts, and logs.
- Tables use 36-44px rows on desktop and transform into prioritized cards on narrow screens.
- Status always combines label, color, and icon/shape; color alone never communicates meaning.
- Dangerous actions are red, never amber, and always require an explicit confirmation summary.

## 5. Responsive Application Shell

### Windows and large desktop: 1280px and above

- Fixed 248px left navigation with logo, organization/branch context, primary modules, and account controls.
- Collapsed 72px icon rail is available for 1280-1439px widths or user preference.
- Top bar contains page context, global search, alerts, help, and account menu.
- Main content uses a 12-column grid, maximum readable content width where appropriate, and full-width data workspaces where density is needed.
- Filter bars and table headers remain sticky without covering focused elements.

### Tablet and compact Windows: 768-1279px

- Navigation defaults to collapsed rail; it opens as a modal drawer.
- Dense dashboard grids reduce from four columns to two.
- Table columns are prioritized; low-priority columns move into a row-details drawer.
- Split views become stacked panels while preserving selection context.

### Mobile: below 768px

- Top app bar plus four-item role-specific bottom navigation.
- All secondary modules move into More.
- Tables become cards with the highest-value fields visible and an explicit View details action.
- Filters open in a full-height bottom sheet with Apply and Clear controls.
- Primary actions become a safe-area-aware sticky footer only when the task benefits from persistence.
- Modals become full-screen sheets; destructive confirmations retain the action summary above the buttons.

### Windows-specific behavior

- Supports Edge and Chrome on Windows 10/11 at 100%, 125%, 150%, and 200% display scaling.
- Full keyboard traversal, visible focus, Escape-to-close, Enter/Space activation, and logical tab order.
- No hover-only actions; row actions remain reachable by keyboard and touch.
- Horizontal overflow is contained inside data regions, never on the whole page.
- Visible scrollbars are respected; layouts do not assume overlay scrollbars.
- Date/time rendering exposes timezone and uses unambiguous day-month-year labels.

## 6. Admin Information Architecture

### Primary navigation

1. Dashboard
2. Bookings
3. Trips and Dispatch
4. Schedules and Routes
5. Fleet and Drivers
6. Customers
7. Payments and Refunds
8. Promotions
9. Reports
10. Support
11. Branch Settings

### Mobile bottom navigation

1. Dashboard
2. Bookings
3. Trips
4. More

## 7. Admin Screens

### `/admin/dashboard`

- Current branch and date context.
- KPI cards: bookings today, revenue today, seats sold, occupancy, departures, delayed trips, refund exposure.
- Live departure board grouped into Boarding, Ready, Delayed, and Departed.
- Booking/revenue trend with an accessible table alternative.
- Action queue: unassigned driver/vehicle, expiring payments, refund requests, support escalations.
- Quick actions: New counter booking, Add trip, Assign vehicle, Export manifest.

### `/admin/bookings`

- Search by booking reference, passenger, mobile number, route, or payment reference.
- Filters: date, branch, trip, status, payment status, channel, and assigned support agent.
- Desktop data table with selectable rows and bulk-safe actions.
- Mobile booking cards with status, route, departure, passenger count, total, and primary contextual action.
- Saved views for Today, Pending payment, Needs attention, Cancelled, and Refunded.

### `/admin/bookings/:bookingId`

- Booking and payment status summary.
- Passenger/seat list, contact details, fare breakdown, payment timeline, audit history, and notification delivery.
- Allowed actions are permission- and policy-aware: resend ticket, record payment, change seats, reschedule, cancel, refund, add internal note.
- Mutation preview states the financial and passenger impact before confirmation.

### `/admin/trips`

- Operational trip list with departure, route, vehicle, driver, sold/capacity, manifest status, and live status.
- Timeline filters for Today, Tomorrow, seven days, and custom date.
- Bulk assignment is available only for compatible vehicles/drivers and requires a review step.

### `/admin/trips/:tripId/dispatch`

- Dispatch header: route, schedule, terminal/gate, vehicle, plate, driver, occupancy, and status.
- Interactive manifest: checked in, boarded, no-show, cancelled, special assistance.
- Seat map synchronized with current bookings and walk-in inventory.
- Driver/vehicle assignment panels with conflict and compliance warnings.
- Status progression: Scheduled → Boarding → Ready → Departed → Arrived → Completed.
- Offline-safe read cache may display the latest manifest snapshot, but mutations require a confirmed connection.

### `/admin/schedules` and `/admin/routes`

- Calendar/list toggle for scheduled departures.
- Recurring schedule editor with effective dates, exceptions, fare rules, vehicle class, and cutoff policies.
- Route detail includes terminals, duration, stop pattern, operator-specific settings, and active schedules.
- Conflict preview appears before publishing schedule changes.

### `/admin/fleet` and `/admin/drivers`

- Fleet cards/table: plate, type, capacity, operational state, assigned trip, maintenance/compliance expiry.
- Vehicle detail: seat layout, documents, maintenance timeline, assignment history.
- Driver list: status, rating, contact, license/compliance expiry, upcoming assignments.
- Assignment conflicts, expired documents, and unavailable resources block dispatch with actionable guidance.

### `/admin/customers`

- Searchable passenger directory with privacy-aware summaries.
- Customer detail: bookings, cancellations, refunds, support notes, eligibility verification state, notification preferences.
- Sensitive fields and exports require explicit permissions and are audited.

### `/admin/payments`

- Ledger-style table for charges, over-the-counter collections, failures, refunds, fees, and settlement status.
- Reconciliation filters by provider, branch, shift, date, and discrepancy state.
- Refund queue exposes policy, refundable amount, prior refund history, and approval status.

### `/admin/promotions`

- Promotion list with status, validity, redemptions, discount exposure, and channel/route scope.
- Creation wizard: eligibility → value/limits → schedule → review.
- Live validation detects overlapping or financially unsafe rules.

### `/admin/reports`

- Revenue, booking, occupancy, route, driver, refund, and channel reports.
- Date/branch/route comparisons with exportable tables.
- Charts never replace exact-value tables and summaries.

### `/admin/support`

- Case queue with SLA, passenger, booking, topic, severity, assignee, and last activity.
- Case detail combines conversation timeline, booking context, permitted actions, and internal notes.

### `/admin/settings`

- Branch details, terminals/gates, counter settings, operating hours, notification templates, local policies, staff access.
- Changes with passenger or financial impact require review and audit notes.

## 8. Superadmin Information Architecture

### Primary navigation

1. Platform Overview
2. Organizations
3. Branches and Terminals
4. Users and Access
5. Platform Bookings
6. Finance and Settlements
7. Risk and Compliance
8. Support Oversight
9. Integrations
10. Audit Log
11. System Health
12. Global Configuration

### Mobile bottom navigation

1. Overview
2. Organizations
3. Alerts
4. More

## 9. Superadmin Screens

### `/superadmin/overview`

- Platform KPIs: gross booking value, net revenue, bookings, passengers, occupancy, active operators, payment success, refunds, incidents.
- Organization performance ranking with fair comparison controls.
- Platform alerts: payment degradation, integration failures, suspicious access, settlement variance, document expiry.
- Regional activity and route health summaries without exposing unnecessary personal data.

### `/superadmin/organizations`

- Multi-tenant organization list with status, branch count, active trips, volume, settlement status, and risk flags.
- Organization onboarding wizard: legal identity → operational profile → finance → initial administrators → review.
- Organization detail separates overview, branches, people/access, finance, integrations, configuration, and audit.
- Suspend/reactivate actions enumerate immediate effects on bookings, payments, staff access, and passenger communication.

### `/superadmin/branches`

- Cross-organization branch and terminal registry.
- Duplicate detection, address/geolocation validation, operating status, ownership, and terminal relationships.
- Global terminal records remain separate from operator-specific branch presence.

### `/superadmin/access`

- Users, roles, permissions, scopes, invitations, sessions, and access-review tabs.
- Permission matrix groups capabilities by domain and indicates inherited versus direct grants.
- Impersonation, if allowed, requires a reason, time limit, visible banner, and complete audit trail.
- High-risk permissions require step-up authentication and dual approval where configured.

### `/superadmin/bookings`

- Platform-wide read/search capability with strict personal-data reveal controls.
- Booking mutation is exceptional, reason-required, and fully audited.
- Organization/branch context is always visible to prevent cross-tenant mistakes.

### `/superadmin/finance`

- Provider transactions, operator settlements, fees, refunds, disputes, reserves, and reconciliation.
- Settlement detail shows source bookings, adjustments, payout destination, approvals, and immutable event history.
- Export access is permissioned, watermarked where appropriate, and audited.

### `/superadmin/compliance`

- Organization, vehicle, and driver requirements with expiry and verification queues.
- Risk signals are explainable and do not trigger irreversible actions without human review.
- Evidence access is least-privilege and time-bound.

### `/superadmin/support`

- Platform support health: open cases, SLA risk, escalations, organization load, recurring issues.
- Superadmins can reassign or escalate cases without becoming the default operational support role.

### `/superadmin/integrations`

- Payment providers, SMS/email, maps, analytics, and webhook connections.
- Each integration shows status, last success/failure, environment, credential rotation state, and delivery logs.
- Secret values are never displayed after creation.

### `/superadmin/audit`

- Immutable event explorer by actor, organization, branch, entity, action, date, risk, and request correlation ID.
- Before/after changes are redacted according to field sensitivity.
- Export and retention actions require dedicated permission.

### `/superadmin/health`

- Service status, queue backlog, webhook failure rate, payment latency, notification delivery, and incident history.
- Alerts link to affected organizations and operational impact, not raw infrastructure internals alone.

### `/superadmin/configuration`

- Global policy defaults, feature flags, booking/refund limits, notification templates, supported payment channels, and reference data.
- Organization overrides are visible beside platform defaults.
- Publishing requires validation, change summary, effective time, rollback path, and audit record.

## 10. Shared Component Architecture

### Shell and navigation

- `ConsoleShell`, `SidebarNav`, `MobileTopBar`, `RoleBottomNav`, `ContextSwitcher`, `GlobalSearch`, `CommandMenu`, `Breadcrumbs`.

### Data presentation

- `MetricCard`, `TrendPanel`, `StatusSummary`, `DataTable`, `ResponsiveRecordList`, `FilterBar`, `FilterSheet`, `SavedViewPicker`, `Pagination`, `ColumnPicker`, `ExportMenu`.

### Operational workflows

- `ActionQueue`, `DepartureBoard`, `ManifestTable`, `DispatchStatusStepper`, `AssignmentPanel`, `ConflictAlert`, `SeatInventoryMap`, `AuditTimeline`.

### Forms and feedback

- Reuse passenger foundations for inputs, selects, toggles, date/time controls, buttons, alerts, skeletons, empty states, dialogs, sheets, and toasts.
- Add `FormSection`, `WizardStepper`, `ReviewSummary`, `ApprovalPanel`, `ReasonField`, `MutationImpactSummary`.

### Domain modules

- `BookingSummary`, `PassengerManifest`, `PaymentTimeline`, `RefundSummary`, `ScheduleRuleEditor`, `VehicleComplianceCard`, `DriverAssignmentCard`, `PermissionMatrix`, `SettlementSummary`, `IntegrationHealthCard`.

Presentation components must not fetch directly. Page-level feature modules own queries and mutations through typed service contracts.

## 11. Frontend State Boundaries

- `session`: identity, roles, permissions, organization/branch scopes, step-up state.
- `consoleContext`: active organization, branch, timezone, business date.
- `listView`: filters, sort, columns, density, saved view, pagination.
- `liveOperations`: trip status, manifest updates, assignments, inventory version, connection freshness.
- `mutationDraft`: form data, validation, impact preview, approval state, idempotency key.
- `notificationCenter`: platform/organization/branch alerts, unread state, acknowledgement.

The server remains authoritative for permissions, price, capacity, settlement, compliance, and state transitions.

## 12. API Boundary Blueprint

### Admin

- `GET /api/admin/dashboard`
- `GET /api/admin/bookings` and `GET/PATCH /api/admin/bookings/:id`
- `POST /api/admin/bookings/:id/resend-ticket`
- `POST /api/admin/bookings/:id/reschedule`
- `POST /api/admin/bookings/:id/cancel`
- `POST /api/admin/bookings/:id/refunds`
- `GET /api/admin/trips` and `GET/PATCH /api/admin/trips/:id`
- `GET/PATCH /api/admin/trips/:id/manifest`
- `POST /api/admin/trips/:id/assignments`
- `POST /api/admin/trips/:id/status-transitions`
- CRUD boundaries for schedules, routes, fleet, drivers, customers, promotions, support cases, and branch settings.
- Read/report/export boundaries for payments, reconciliation, revenue, occupancy, routes, and operations.

### Superadmin

- `GET /api/platform/overview`
- CRUD and lifecycle boundaries for organizations, branches, terminals, invitations, roles, permissions, and scoped assignments.
- Search/read boundaries for platform bookings with privileged mutation endpoints kept separate.
- Finance boundaries for transactions, settlements, adjustments, disputes, refunds, approvals, and exports.
- Compliance boundaries for requirements, evidence, verification decisions, and expiry queues.
- Integration boundaries for connection metadata, tests, webhook delivery logs, and credential rotation.
- Read-only audit search plus separately permissioned export.
- Health, incident, feature-flag, global policy, template, and reference-data boundaries.

All mutations require idempotency, scope validation, audit context, and an explicit concurrency/version token for editable operational records.

The listed `/api` routes are application-facing contracts. Simple scoped reads may use the Supabase client under RLS; privileged mutations, external-provider calls, secret-bearing operations, and multi-table transactions go through server routes, database RPC functions, or Edge Functions.

## 13. Supabase Data Architecture

### Multi-tenancy and access

- `organizations`: legal and operational identity, status, timezone, settlement profile.
- `branches`: organization, terminal relationship, address, operating state, settings.
- `roles`, `permissions`, `role_permissions`.
- `user_role_assignments`: user, role, organization scope, branch scope, validity window.
- `access_invitations`, `user_sessions`, `step_up_challenges`, `access_reviews`.

### Operations

- Existing routes, trips, vehicles, seats, drivers, bookings, payments, and refunds gain organization/branch ownership where required.
- `trip_assignments`: trip, vehicle, driver, assignment state, conflict metadata, version.
- `manifest_events`: trip, booking passenger, event type, actor, timestamp, device metadata.
- `schedule_rules` and `schedule_exceptions`.
- `vehicle_documents`, `driver_documents`, `maintenance_events`.

### Finance and governance

- `settlements`, `settlement_items`, `settlement_adjustments`, `settlement_approvals`.
- `support_cases`, `support_messages`, `internal_notes`, `case_assignments`.
- `integration_connections`, `webhook_endpoints`, `webhook_deliveries`.
- `feature_flags`, `feature_flag_scopes`, `policy_definitions`, `policy_overrides`.
- `audit_events` append-only with actor, scope, request correlation, entity, action, and redacted change metadata.
- `approval_requests` for high-risk, dual-control actions.

Organization ownership and scoped uniqueness constraints prevent cross-tenant collisions. Row-level security or an equivalent enforced repository boundary is required in addition to application checks.

### Authentication and profile mapping

- `auth.users` remains Supabase-owned; application tables reference its UUID and never duplicate password material.
- A signup trigger creates the minimal `profiles` row. Organization access is granted separately through invitations and membership approval.
- Passenger registration supports verified mobile/email based on the configured provider. Staff and Superadmin accounts require verified identity and are MFA-ready.
- Auth callbacks validate the intended redirect path and never accept an arbitrary external return URL.
- Suspension is represented in application membership/status records and enforced by RLS and server-side guards even if an Auth session still exists.

### Row Level Security policy matrix

| Data group | Passenger | Admin | Superadmin |
|---|---|---|---|
| Published routes, terminals, trips | Read public/published records | Read within organization/branch | Read platform-wide |
| Profile | Read/update own permitted fields | Read minimum required support fields within scope | Restricted privileged access with audit |
| Bookings and passengers | Own bookings only | Scoped organization/branch operations | Platform search; mutation requires elevated permission |
| Seat inventory and holds | Read availability; mutate through validated RPC | Scoped operational read/mutation | Platform oversight |
| Payments and refunds | Own sanitized records | Scoped finance permission | Platform finance permission |
| Fleet, drivers, schedules | Passenger-safe published subset | Scoped operational access | Platform-wide access |
| Roles, memberships, policies | No access | Scoped staff administration if granted | Platform access with high-risk controls |
| Audit and compliance evidence | No direct access | Explicit scoped permission | Explicit platform permission |

Policy rules derive scope from `auth.uid()` through indexed membership and permission helper functions. Service-role access is not a substitute for RLS in ordinary application requests.

### Transactional database functions

- `search_available_trips` — returns published trips and computed seat availability.
- `hold_trip_seats` — locks inventory, verifies eligibility, creates a TTL hold, and returns authoritative expiry/server time.
- `update_seat_hold` and `release_seat_hold` — modify or release only the caller's valid hold.
- `quote_booking` — calculates fares, fees, discounts, and cancellation terms from current rules.
- `confirm_booking` — atomically validates hold and quote versions before creating booking/passengers/payment intent.
- `transition_trip_status` — enforces the operational state machine and scoped permission.
- `assign_trip_resources` — validates driver/vehicle availability and compliance before assignment.
- `request_booking_refund` — calculates the allowed refund and creates the approval/payment workflow idempotently.

Security-definer functions must set an explicit safe search path, validate the caller and scope internally, expose the smallest required result, and receive automated permission tests.

### Realtime

- Trip-specific channels update seat availability, hold expiry, manifest, trip status, and assignments.
- Branch channels update departure boards and action queues.
- User-specific channels update booking/payment status and notifications.
- Subscriptions are filtered by tenant and protected by RLS; reconnects always refetch a canonical snapshot before applying new events.
- Realtime is an enhancement, not the source of truth. All writes are confirmed by the database response.

### Storage

| Bucket | Visibility | Rules |
|---|---|---|
| `avatars` | Public or transformed public assets | User controls own object; strict type and size limits |
| `eligibility-documents` | Private | Passenger owns upload; only authorized verification staff receive short-lived signed URLs |
| `compliance-documents` | Private | Organization-scoped upload and review; platform access requires permission and audit |
| `tickets` | Private | Booking owner and authorized staff receive expiring signed URLs |
| `exports` | Private and temporary | Generated asynchronously; short retention and signed download links |

Uploads validate MIME type, extension, size, ownership path, and malware-review strategy where required. Database rows record document state and metadata; Storage paths are not treated as authorization.

### Edge Functions and scheduled work

- Payment provider webhooks verify signatures, deduplicate provider events, and update payment/booking state transactionally.
- SMS/email functions receive normalized notification jobs and never expose provider credentials to the browser.
- Scheduled jobs release expired seat holds, send departure reminders, flag expiring compliance records, and reconcile delayed payment events.
- Failed jobs use bounded retries and a reviewable dead-letter state instead of infinite retry loops.
- Every external event stores provider ID, processing status, attempt count, and correlation ID for support and audit.

### Migrations and environments

- All schema, functions, RLS policies, indexes, triggers, storage policies, and seed reference data are versioned in Supabase migrations.
- No production table or policy is edited manually without a matching migration.
- Local development uses local Supabase or an isolated development project; Vercel previews use staging; production uses its own project.
- Seed data contains synthetic passengers and payments only.
- Backups, point-in-time recovery expectations, retention, and restore drills are documented before launch.

## 14. Test and Acceptance Matrix

### Responsive and Windows

- Phone widths: 320, 360, 390, 430px.
- Tablet: 768 and 1024px.
- Windows viewports: 1280×720, 1366×768, 1440×900, 1920×1080.
- Display scaling: 100%, 125%, 150%, 200%.
- Keyboard-only and touch-capable Windows device coverage.

### Role and security

- Each role sees only permitted navigation and actions.
- Direct URL/API access outside scope is rejected.
- Organization and branch switching cannot leak cached cross-tenant data.
- High-risk actions require reason/approval/step-up as configured.
- Audit records exist for reads/exports of sensitive data and all mutations.
- RLS tests execute as anonymous, passenger, each staff role, and Superadmin—not only as service role.
- Storage policies reject cross-user and cross-organization paths.
- Preview and staging deployments cannot connect to production Supabase.

### Operational edge cases

- Concurrent seat or assignment changes.
- Trip status edited from two devices.
- Expired session during an unsaved form.
- Offline or reconnecting dispatch device.
- Payment succeeds after client timeout.
- Partial refund, failed refund, and duplicate submission.
- Large lists, long passenger/operator names, empty states, and timezone boundaries.

## 15. Delivery Order

1. Confirm the existing repository and reconcile its current framework, authentication, and schema with the target platform decision.
2. Establish local/staging/production Supabase environment boundaries and migration workflow.
3. Create Supabase Auth profile mapping, organization/branch memberships, RBAC helpers, RLS, and route guards.
4. Extend shared tokens and base components from the passenger app.
5. Build the shared responsive console shell and navigation.
6. Deliver Admin Dashboard, Bookings, and Trip Dispatch with live scoped data first.
7. Add schedules/routes, fleet/drivers, payments/refunds, customers, reports, support, and settings.
8. Deliver Superadmin Overview, Organizations, Access, Finance, Audit, Health, and Configuration.
9. Complete mobile/tablet adaptations and Windows scaling/keyboard validation for every shipped module.
10. Add database/RLS tests and end-to-end role, booking, dispatch, refund, and governance tests.
11. Run migration rehearsal, visual comparison, production-build validation, and staging smoke tests.
12. Prepare Vercel production settings; deploy only after the user explicitly authorizes deployment.

## 16. Vercel Runtime and Deferred Deployment

### Project structure

- Passenger, Admin, and Superadmin live in one Next.js application unless the existing repository already has a justified monorepo boundary.
- Route groups keep layouts and authorization separate while sharing design tokens, domain types, and tested components.
- Server routes and server actions hold privileged orchestration. Client components are limited to interactive UI and browser-safe Supabase access.
- Middleware may perform an early session/route check, but database RLS and server authorization remain the final security boundary.

### Environment variables

Browser-exposed:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only examples:

- `SUPABASE_SERVICE_ROLE_KEY`
- Payment provider secrets and webhook signing secrets
- SMS/email provider credentials
- Cron or internal job authorization secret

Local environment files remain uncommitted. Vercel variables are separated by Development, Preview, and Production scopes, and secrets are rotated after accidental exposure.

### Build and release gates

- Type checking, linting, production build, database tests, RLS tests, and critical end-to-end flows pass.
- Supabase migrations apply cleanly to a disposable/staging database and have an explicit rollback/forward-fix strategy.
- Preview URLs use staging-only data and credentials.
- Authentication callback URLs, allowed origins, payment webhooks, and notification links are configured for the intended environment.
- Mobile widths and Windows desktop/scaling matrix pass before production promotion.
- Security headers, error monitoring, analytics consent, privacy copy, and operational alerting are reviewed.

### Deployment status

Vercel deployment is intentionally deferred. No Vercel project, production environment variable, domain, or live deployment should be created until the user explicitly asks to deploy.

## 17. Implementation Blocker

The current workspace contains only planning documents. There is no frontend application, package manifest, route structure, Supabase project configuration, or migration history to extend. Provide the real VanGO repository path or place the project inside `C:\Users\4tvon\OneDrive\Documents\VanGO` before implementation begins. Supabase project identifiers and Vercel deployment authorization are not needed until implementation reaches their respective setup stages.
