# VanGO Passenger Web

This folder is the standalone passenger-facing VanGO application. It is a real Next.js website with Supabase authentication and database-backed passenger workflows; it does not contain demo accounts, seeded UI records, or Admin/Superadmin screens.

## Included passenger flows

- Email sign-up, sign-in, sign-out, recovery, and password update
- Dashboard backed by the signed-in passenger's bookings, notifications, and support cases
- Live terminal and trip search
- Seat availability, timed seat holds, and passenger details
- Explicitly simulated payment and refund confirmation (no payment provider or real funds)
- Booking history, printable e-ticket, notifications, profile, and support conversations
- Desktop sidebar, mobile bottom tabs, responsive booking forms, and accessible states

## Local setup

1. Run the existing schema in `../supabase/vango_full_schema.sql` through the Supabase SQL editor.
2. Copy `.env.example` to `.env.local` and set the public project values:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3020
   ```

3. Install and start:

   ```powershell
   npm install
   npm run dev
   ```

4. Open `http://localhost:3020`.

The public publishable key is safe for browser use when Row Level Security remains enabled. Never place a Supabase service-role key in this application.

## Validation

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Vercel

Set the Vercel Root Directory to `vango-user-web`, add the same public environment variables, and set `NEXT_PUBLIC_SITE_URL` to the production URL. Deployment is intentionally deferred until requested.

## Payment scope

Payment and refund records are deliberately simulated through the existing database RPCs. The interface labels them as mock/simulated, and no card, wallet, bank, or payment gateway is called.
