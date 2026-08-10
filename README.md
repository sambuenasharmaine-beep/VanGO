# VanGO

VanGO is a responsive passenger transport booking platform with Passenger, Admin, and Superadmin workspaces. It uses Vinext/React for the web application and Supabase for Auth, PostgreSQL, Row Level Security, Realtime, and protected document storage.

Payments and refunds are intentionally simulated. VanGO does not connect to a bank, card, wallet, or real payment provider.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The current local URL is normally `http://localhost:3010`.

## Supabase setup

1. Create a new Supabase project.
2. Paste `supabase/vango_full_schema.sql` into the Supabase SQL Editor and run it once.
3. Copy `.env.example` to `.env.local` and enter the Supabase URL, publishable key, service-role key, and the two privileged account credentials.
4. Restart or deploy VanGO.

The SQL creates the production `VanGO Transport` organization and `Main Operations` branch. On the first server request, VanGO uses Supabase's server-only Auth Admin API to create the configured Superadmin and Admin users, confirm their email addresses, assign their real memberships, and record an idempotent private bootstrap marker. Later requests do not recreate or reset those accounts.

The service-role key and bootstrap passwords are server-only. Never prefix them with `NEXT_PUBLIC_`, commit `.env.local`, or expose them in browser code.

After bootstrap, ordinary passengers use the registration form. Staff accounts and invitations are managed by the Superadmin workspace.

## Verification

```bash
npm run lint
npx tsc --noEmit --incremental false
npm test
```

`npm test` performs the production build and validates authentication, routes, mock-only finance, database contracts, responsive behavior, and feature integration.
