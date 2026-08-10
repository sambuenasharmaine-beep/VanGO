# VanGO Supabase setup

The database is intentionally prepared as one pasteable development bootstrap:

- Open a new Supabase project.
- Open **SQL Editor → New query**.
- Copy the entire contents of `vango_full_schema.sql`, paste it once, and run it.
- Do not add a payment gateway. The schema only permits `provider = 'mock'` and `method = 'mock_payment'`; no real funds can be charged.

After the SQL succeeds, copy `.env.example` to `.env.local` and fill only:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Restart the local website after changing environment variables.

## First Superadmin

Create or register the intended user in Supabase Auth first. Then run this small bootstrap separately with that user's Auth UUID:

```sql
insert into public.memberships (user_id, role, status)
values ('PASTE_AUTH_USER_UUID_HERE', 'superadmin', 'active');
```

The Superadmin can then create organizations, branches, and staff memberships from VanGO. Ordinary registration always creates a passenger account and cannot self-select an Admin or Superadmin role.

## Order to populate the platform

Each step is a prerequisite for the next, and every screen below is a real form
in the app — no UUID is ever typed by hand:

1. **Superadmin → Organizations** creates the operator.
2. **Superadmin → Terminals** creates the shared origin and destination points.
3. **Superadmin → Branches** attaches a branch to the organization.
4. **Superadmin → Users & access** selects a registered account by name/email and grants a staff membership so the Admin console opens.
5. **Admin → Routes** links two terminals and must be set to `published` before passengers can find it.
6. **Admin → Trips & dispatch** schedules a departure. Seat inventory is generated
   by the database from the trip capacity, so the trip is immediately bookable.

## Realtime

The bootstrap adds the shared operational tables to the `supabase_realtime`
publication and sets `replica identity full` on them. Passenger, Admin, and
Superadmin sessions subscribe to the same tables, so a seat hold, a mock payment,
or a trip status change appears in the other consoles without a refresh. Row
Level Security is applied to every change event, so a subscriber is only notified
about rows it is already allowed to read.

Published-trip access for signed-in passengers is separate from staff access.
Staff Realtime events and table reads remain limited to their assigned
organization/branch; a published route does not bypass that tenant boundary.

## Important boundaries

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is safe for the browser because Row Level Security controls access.
- Never place `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_*` variable or browser code.
- `vango_full_schema.sql` is intended for a new development project and has not been executed remotely from this workspace.
- Deployment and production environment setup remain intentionally deferred.
