import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const accessUrl = new URL("../lib/auth-access.ts", import.meta.url);
const formUrl = new URL("../app/components/auth-form.tsx", import.meta.url);
const clientGateUrl = new URL("../app/components/auth-gate.tsx", import.meta.url);
const serverGateUrl = new URL("../app/components/server-workspace-gate.tsx", import.meta.url);
const bootstrapUrl = new URL("../lib/bootstrap-accounts.ts", import.meta.url);
const schemaUrl = new URL("../supabase/vango_full_schema.sql", import.meta.url);
const envUrl = new URL("../.env.example", import.meta.url);

test("login honors only safe role-compatible return paths", async () => {
  const [access, form] = await Promise.all([
    readFile(accessUrl, "utf8"),
    readFile(formUrl, "utf8"),
  ]);

  assert.match(access, /raw\.startsWith\("\/\/"\)/);
  assert.match(access, /raw\.includes\("\\\\"\)/);
  assert.match(access, /returnTo\.startsWith\("\/superadmin\/"\).*isSuperadmin/);
  assert.match(access, /returnTo\.startsWith\("\/admin\/"\).*memberships\.length > 0/);
  assert.match(form, /destinationFor\(memberships, returnTo\)/);
  assert.match(form, /exchangeCodeForSession\(recoveryCode\)/);
  assert.match(form, /auth\.updateUser\(\{ password \}\)/);
});

test("server and client gates allow Superadmin operations without exposing unconfigured pages", async () => {
  const [clientGate, serverGate] = await Promise.all([
    readFile(clientGateUrl, "utf8"),
    readFile(serverGateUrl, "utf8"),
  ]);

  assert.match(clientGate, /workspace === "admin" \? isStaff : isSuperadmin/);
  assert.match(serverGate, /workspace === "admin"\s*\? isStaff/);
  assert.match(serverGate, /if \(!isSupabaseServerConfigured\(\)\) return <SetupRequired/);
});

test("privileged accounts bootstrap through the server-only Supabase Admin API", async () => {
  const [bootstrap, schema, env] = await Promise.all([
    readFile(bootstrapUrl, "utf8"),
    readFile(schemaUrl, "utf8"),
    readFile(envUrl, "utf8"),
  ]);

  assert.match(bootstrap, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(bootstrap, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(bootstrap, /auth\.admin\.createUser/);
  assert.match(bootstrap, /email_confirm: true/);
  assert.match(bootstrap, /role: "superadmin"/);
  assert.match(bootstrap, /role: "branch_admin"/);
  assert.match(schema, /create table if not exists public\.system_bootstrap_state/);
  assert.match(schema, /'system_bootstrap_state'/);
  assert.match(schema, /values \('VanGO Transport', 'vango-transport'/);
  assert.doesNotMatch(schema, /insert into auth\.users/i, "login-capable Auth users must not be inserted manually through SQL");
  assert.match(env, /VANGO_SUPERADMIN_EMAIL=/);
  assert.match(env, /VANGO_ADMIN_PASSWORD=/);
});
