import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFile(join(root, path), "utf8");

test("passenger navigation exposes real application tabs", async () => {
  const shell = await read("app/components/user-shell.tsx");
  for (const path of ["/user", "/user/search", "/user/bookings", "/user/support", "/user/alerts", "/user/profile"]) assert.match(shell, new RegExp(path.replaceAll("/", "\\/")));
  assert.match(shell, /mobile-tabs/);
  assert.match(shell, /side-nav/);
});

test("booking journey uses the database RPC contract", async () => {
  const flow = await read("app/components/trip-flow.tsx");
  for (const rpc of ["search_available_trips", "get_trip_seat_map", "hold_trip_seats", "complete_mock_payment"]) assert.match(flow, new RegExp(rpc));
  assert.match(flow, /No real money will be charged/);
});

test("passenger features query account data and never expose role dashboards", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const shell = await read("app/components/user-shell.tsx");
  const account = await read("app/components/account-features.tsx");
  assert.equal(packageJson.name, "vango-user-web");
  assert.doesNotMatch(shell, /href=["'`]\/(admin|superadmin)/i);
  for (const table of ["bookings", "notifications", "support_cases", "booking_passengers", "refunds"]) assert.match(account, new RegExp(`from\\(["']${table}["']\\)`));
});

test("responsive styles cover desktop shell and compact mobile layout", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.mobile-tabs/);
  assert.match(css, /\.sidebar/);
  assert.match(css, /grid-template-columns/);
});

test("authentication is Supabase-backed and registration is passenger-only", async () => {
  const login = await read("app/login/login-panel.tsx");
  const layout = await read("app/user/layout.tsx");
  assert.match(login, /auth\.signInWithPassword/);
  assert.match(login, /auth\.signUp/);
  assert.doesNotMatch(login, /role\s*:\s*["'](?:admin|superadmin)["']/i);
  assert.match(login, /Passenger accounts never receive Admin or Superadmin access/);
  assert.match(layout, /redirect\("\/login(?:\?[^"']*)?"\)/);
  assert.match(layout, /never falls back to demo records/);
});
