# VanGO Passenger UI Architecture Blueprint

## 1. Objective

Rebuild the VanGO user-facing booking experience using the supplied VanGo Passenger App and VanGo Design System as the visual and interaction reference. Preserve VanGO branding, routes, business rules, and real data; adopt the reference's hierarchy, component behavior, and mobile-first booking flow.

Reference files:

- `C:\Users\4tvon\Downloads\VanGo booking platform design\VanGo Passenger App.dc.html`
- `C:\Users\4tvon\Downloads\VanGo booking platform design\VanGo Design System.dc.html`
- `C:\Users\4tvon\Downloads\VanGo booking platform design\.thumbnail`

## 2. Product Principles

- Mobile-first baseline: 390px wide, safe-area aware, and usable down to 320px.
- Minimum interactive target: 44px; default controls: 48px; primary mobile CTA: 56px.
- One amber primary action per screen. Teal carries navigation, headers, selected states, and structure.
- Booking-critical data such as times, fares, seat numbers, plates, and references uses tabular monospace numerals.
- Every network-backed view must define loading, empty, offline, error, and retry behavior.
- The booking CTA and running total remain visible when the user is making a time-sensitive selection.
- Accessibility is structural: semantic headings, real form labels, focus rings, screen-reader status announcements, and non-color state indicators.

## 3. Design Tokens

### Color

| Token | Value | Use |
|---|---:|---|
| `teal-50` | `#E7F0F3` | Selected-row tint and subtle teal surfaces |
| `teal-100` | `#CFE1E7` | Quiet teal borders |
| `teal-600` | `#0E4D64` | Headers, navigation, links, selected seats |
| `teal-700` | `#0B3E51` | Hover state |
| `teal-800` | `#082F3D` | Pressed state and deep footer surfaces |
| `amber-500` | `#F59E0B` | Single primary action |
| `amber-600` | `#D97706` | Primary-action hover and warning |
| `amber-700` | `#B45309` | Primary-action active state |
| `amber-50` | `#FEF3E2` | Amber tint |
| `ink` | `#0F172A` | Primary text |
| `muted` | `#667085` | Secondary text |
| `border` | `#E4E7EC` | Default borders |
| `canvas` | `#F6F7F9` | App background |
| `surface` | `#FFFFFF` | Cards and sheets |
| `success` | `#15803D` | Confirmed and successful states |
| `danger` | `#DC2626` | Errors and destructive actions |
| `info` | `#0369A1` | Informational feedback |
| `pwd` | `#7C3AED` at 12% | PWD/senior-reserved seats |

### Typography

| Role | Family | Specification |
|---|---|---|
| Display | Plus Jakarta Sans | 44/1.05/700, tracking `-0.03em` |
| H1 | Plus Jakarta Sans | 32/1.15/700, tracking `-0.025em` |
| H2 | Plus Jakarta Sans | 24/1.25/700, tracking `-0.02em` |
| H3 | Plus Jakarta Sans | 20/1.30/600 |
| Title | Plus Jakarta Sans | 17/1.35/600 |
| Body | Inter | 15/1.55/400 |
| Small | Inter | 13/1.50/400 |
| Overline | Inter | 11/1.40/500, tracking `0.08em` |
| Operational data | JetBrains Mono | 14-22/1.40/500-700, tabular numerals |

### Layout and motion

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, and 80px.
- Radii: 10px controls, 12px cards/sheets, 999px pills/avatars; 20px is reserved for device-frame previews, not app cards.
- Elevation uses no more than 8% opacity: small for cards, medium for dropdowns/sticky footers, large for modals.
- Focus ring: 3px teal at 18% opacity.
- Motion is limited to meaningful transitions, loading shimmer, sheet entry, selection feedback, and reduced-motion alternatives.

## 4. Navigation and Route Map

### Authentication stack

1. `/login`
2. `/register`
3. `/verify-otp`
4. `/forgot-password`
5. `/forgot-password/sent`

### Authenticated passenger stack

1. `/home` — greeting, search form, recent searches, saved routes, promo.
2. `/trips/search` — trip results with filters, sorting, loading, empty, and offline states.
3. `/booking/:tripId/seats` — seat map and live running total.
4. `/booking/:tripId/passengers` — passenger forms, payment selection, fare summary, and seat-hold timer.
5. `/booking/:bookingId/confirmed` — confirmation and next actions.
6. `/bookings` — upcoming, completed, and cancelled tabs.
7. `/bookings/:bookingId/ticket` — QR e-ticket, route timeline, driver/vehicle details, policies.
8. `/alerts` — trip reminders, delays, gate changes, and transaction notices.
9. `/profile` — personal info, saved payment methods, notification preferences, logout.

Persistent bottom navigation appears only at the four top-level destinations: Home, Bookings, Alerts, and Profile.

## 5. Screen Requirements

### Account

- Login: email/mobile and password, remember-me option, password recovery, Google entry point, and registration link.
- Login error: inline alert, field-level error, attempt counter, and preserved user identifier.
- Registration: two steps, Philippine mobile prefix, password strength, consent, SMS verification.
- OTP: six-digit segmented input, resend countdown, change-number action, and carrier-delay guidance.
- Password recovery: email submission followed by a clear sent state with throttling guidance.

### Search and trip discovery

- Home search card: origin, destination, date, passenger/seat count, and explicit Search vans CTA.
- Secondary content: recent searches, saved routes, and a single restrained promo card.
- Results header retains the query and exposes filters/sort.
- Trip card shows departure/arrival times, duration, stop type, fare, operator, rating, plate, terminal, and remaining seats.
- Sold-out trips replace selection with seat-availability notification.
- Empty results recommend clearing filters, another date, or a nearby terminal.
- Offline results preserve the query and expose both retry and saved e-ticket access.

### Booking

- Seat selection models available, selected, occupied, and PWD/senior-reserved states with labels and icons.
- A seat-hold timer begins when inventory is reserved and remains visible through payment.
- Sticky footer shows selected seat chips, running total, and Continue.
- Passenger details render one passenger form per seat with an optional Use my info shortcut for the lead passenger.
- Payment methods are selectable cards for supported wallets, cards, and over-the-counter channels.
- Fare breakdown itemizes seat fares, booking fees, discounts, and total.
- Terms acknowledgement is required before the Pay now action is enabled.
- Confirmation exposes booking reference, route, date, seats, plate, total paid, download, calendar, and My Bookings entry.

### Trip management

- Bookings use Upcoming, Completed, and Cancelled tabs.
- Each booking card presents status, urgency/departure countdown, reference, seats, operator/plate, amount due, and the context-specific action.
- Empty bookings preserve a Book again recommendation without competing with the Find a van primary action.
- E-ticket prioritizes QR code and booking reference, followed by terminal timeline, passenger list, driver/vehicle, and cancellation policy.
- Reschedule and cancellation open confirmation flows; cancellation must state refund timing and fee treatment before confirmation.

### Profile and alerts

- Profile header includes identity, edit action, trip count, annual spend, and passenger rating.
- Personal data, eligibility ID, saved payments, and notification settings are separated into cards.
- Alerts distinguish operational notices from marketing and provide read/unread, deep-link, and empty states.

## 6. Reusable UI Modules

### Foundations

- `AppShell`, `SafeArea`, `PageHeader`, `BottomTabBar`, `StickyActionBar`
- `AppLogo`, `Icon`, `Avatar`, `Heading`, `BodyText`, `OperationalText`
- `Button`, `IconButton`, `TextLink`, `Badge`, `StatusPill`, `Divider`
- `Card`, `Sheet`, `Modal`, `Toast`, `InlineAlert`, `Skeleton`, `EmptyState`

### Forms

- `FormField`, `TextInput`, `PasswordInput`, `PhoneInput`, `OtpInput`
- `SearchCombobox`, `SelectField`, `DatePicker`, `SeatCountPicker`
- `Checkbox`, `RadioCard`, `Toggle`, `FieldError`, `PasswordStrength`

### Booking domain

- `RouteSearchCard`, `RecentSearchItem`, `SavedRouteCard`, `PromoCard`
- `TripResultCard`, `TripFiltersSheet`, `TripSortMenu`, `AvailabilityNoticeAction`
- `VehicleSeatMap`, `SeatButton`, `SeatLegend`, `SeatSelectionSummary`, `SeatHoldTimer`
- `PassengerFormCard`, `PaymentMethodCard`, `FareBreakdown`
- `BookingStatusCard`, `BookingTimeline`, `TicketQrCard`, `DriverVehicleCard`, `CancellationPolicyCard`

Each domain component receives data and callbacks; routing, fetching, mutation, and payment SDK concerns stay outside presentation components.

## 7. Frontend State Boundaries

- `authSession`: current passenger, authentication status, verification state.
- `searchDraft`: origin, destination, travel date, seat count, active filters, sort order.
- `searchResults`: query key, result list, pagination, freshness, loading/error/offline status.
- `seatSelection`: trip inventory version, selected seat IDs, reserved seat IDs, hold ID, expiry.
- `bookingDraft`: passengers keyed by seat, payment method, promo, terms acceptance.
- `booking`: booking state, payment state, ticket details, cancellation/refund eligibility.
- `notifications`: operational alerts, marketing alerts, unread count, preferences.

Server state should be cached by stable query keys. Seat inventory, holds, fares, payment status, and booking status remain server-authoritative.

## 8. API Contract Blueprint

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Email/mobile authentication |
| `POST` | `/api/auth/register` | Create passenger and initiate verification |
| `POST` | `/api/auth/otp/verify` | Verify SMS code |
| `POST` | `/api/auth/otp/resend` | Resend with throttling |
| `POST` | `/api/auth/password/forgot` | Issue password reset link |
| `GET` | `/api/locations/search?q=` | Origin/destination autocomplete |
| `GET` | `/api/trips/search` | Search by route, date, seats, filters, and sort |
| `GET` | `/api/trips/:tripId` | Trip, operator, vehicle, terminal, fare, and policy |
| `GET` | `/api/trips/:tripId/seats` | Versioned live seat inventory |
| `POST` | `/api/trips/:tripId/holds` | Atomically reserve seats for a short TTL |
| `PATCH` | `/api/holds/:holdId` | Change selected seats during an active hold |
| `DELETE` | `/api/holds/:holdId` | Release held inventory |
| `POST` | `/api/bookings/quote` | Calculate authoritative fare and promo result |
| `POST` | `/api/bookings` | Create booking against valid hold and quote |
| `POST` | `/api/bookings/:bookingId/payments` | Initialize selected payment channel |
| `GET` | `/api/bookings` | List by upcoming/completed/cancelled status |
| `GET` | `/api/bookings/:bookingId` | Booking detail and e-ticket payload |
| `POST` | `/api/bookings/:bookingId/reschedule` | Quote or apply eligible reschedule |
| `POST` | `/api/bookings/:bookingId/cancel` | Confirm cancellation and initiate refund |
| `GET/PATCH` | `/api/profile` | Read or update passenger profile |
| `GET/POST/DELETE` | `/api/profile/payment-methods` | Manage tokenized payment methods |
| `GET/PATCH` | `/api/notifications` | List and mark notifications read |
| `GET/PATCH` | `/api/notification-preferences` | Manage operational and marketing preferences |

All booking mutations require idempotency keys. Seat holds and checkout responses return an authoritative server time and expiry to prevent device-clock drift.

## 9. Supabase PostgreSQL Schema Blueprint

### Identity and profile

- `users`: id, email, mobile_e164, password_hash/provider identity, status, verified_at, created_at.
- `passenger_profiles`: user_id, full_name, birth_date, eligibility_type, eligibility_reference, rating, preferences.
- `user_devices`: user_id, push_token, platform, last_seen_at.
- `payment_methods`: id, user_id, provider, provider_token, masked_label, expiry metadata, is_default.

### Transport catalog

- `operators`: id, name, status, support details.
- `terminals`: id, name, address, city, latitude, longitude.
- `routes`: id, origin_terminal_id, destination_terminal_id, typical_duration_minutes, status.
- `vehicles`: id, operator_id, type, make_model, plate_number, capacity, accessibility metadata.
- `vehicle_seats`: id, vehicle_id, seat_code, row_number, column_number, seat_type, active.
- `trips`: id, route_id, vehicle_id, departure_at, arrival_at, fare, trip_status, inventory_version.

### Inventory and booking

- `seat_holds`: id, user/session key, trip_id, expires_at, released_at, status.
- `seat_hold_items`: hold_id, trip_id, vehicle_seat_id; unique active constraint per trip and seat.
- `bookings`: id, reference, user_id, trip_id, hold_id, booking_status, payment_status, currency, subtotal, fees, discount, total, created_at.
- `booking_passengers`: id, booking_id, vehicle_seat_id, full_name, mobile_e164, birth_date, eligibility snapshot.
- `payments`: id, booking_id, provider, provider_reference, method_type, amount, status, idempotency_key, timestamps.
- `refunds`: id, payment_id, booking_id, amount, reason, status, provider_reference, timestamps.
- `promotions`: id, code, rule definition, validity window, limits, status.
- `promotion_redemptions`: promotion_id, booking_id, user_id, discount_amount.

### Operations and communication

- `drivers`: id, operator_id, name, mobile_e164, rating, status.
- `trip_driver_assignments`: trip_id, driver_id, assigned_at.
- `notifications`: id, user_id, booking_id, type, title, body, deep_link, read_at, created_at.
- `notification_preferences`: user_id, trip_reminders, service_updates, promotions.
- `audit_events`: actor_id, entity_type, entity_id, action, metadata, created_at.

Seat availability must be enforced transactionally in PostgreSQL; client-side disabled states are only presentation safeguards.

## 10. Delivery Sequence

1. Confirm the actual VanGO frontend path, framework, current route map, and existing brand assets.
2. Add tokens, typography, reset styles, safe-area primitives, and accessible base controls.
3. Build the authenticated shell and top-level navigation.
4. Implement authentication screens and validation states.
5. Implement Home and location/date/seat search controls.
6. Implement trip results, filters, sorting, loading, empty, and offline states.
7. Implement live seat inventory, atomic hold lifecycle, timer, and sticky selection summary.
8. Implement passenger forms, fare quote, promo, payment selection, and payment feedback.
9. Implement confirmation, My Bookings, e-ticket, reschedule, and cancellation flows.
10. Implement Alerts and Profile.
11. Add analytics, accessibility checks, responsive coverage, unit tests, integration tests, and end-to-end booking tests.
12. Validate against the supplied reference at 390px and the app's supported breakpoints before release.

## 11. Acceptance Criteria

- All 18 supplied passenger reference states have an equivalent VanGO state or a documented business-rule exception.
- No actionable control is smaller than 44px.
- Only one amber primary action is present per view.
- Keyboard focus is visible and logical; labels and errors are announced correctly.
- Loading, empty, offline, error, retry, sold-out, seat-expired, payment-declined, and booking-confirmed states are testable.
- Seat inventory cannot be double-booked under concurrent requests.
- Price and eligibility calculations displayed by the client match the authoritative quote and booking records.
- Bottom navigation appears only on the four top-level passenger destinations.
- Booking references, fares, times, seat numbers, and plate numbers use tabular operational typography.
- The completed UI is visually compared with the supplied VanGo design source at mobile width before approval.

## 12. Target Platform and Current Blocker

The passenger UI shares the same target platform as the Admin and Superadmin consoles: Next.js with TypeScript, Supabase Postgres/Auth/RLS/Realtime/Storage, and Vercel hosting. The detailed platform, security, environment, and deferred-deployment decisions are defined in `ADMIN_SUPERADMIN_UI_BLUEPRINT.md` and apply to passenger data and workflows as well.

The active workspace contains no application source files. UI implementation should begin only after the existing VanGO project is placed in `C:\Users\4tvon\OneDrive\Documents\VanGO` or its actual editable path is provided. Vercel deployment remains deferred until the user explicitly authorizes it.
