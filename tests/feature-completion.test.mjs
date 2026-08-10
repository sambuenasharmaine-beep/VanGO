import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("new operational and governance routes have real page entry points", async () => {
  const routes = [
    "app/passenger/support/page.tsx",
    "app/admin/drivers/page.tsx",
    "app/admin/assignments/page.tsx",
    "app/admin/schedule-rules/page.tsx",
    "app/admin/schedule-exceptions/page.tsx",
    "app/admin/refunds/page.tsx",
    "app/superadmin/refunds/page.tsx",
    "app/superadmin/invitations/page.tsx",
    "app/superadmin/access-reviews/page.tsx",
  ];
  await Promise.all(routes.map((route) => access(new URL(route, root))));
});

test("privileged workflows are enforced in security-definer database functions", async () => {
  const schema = await readFile(new URL("supabase/vango_full_schema.sql", root), "utf8");
  const routines = [
    "assign_trip_resources",
    "create_support_case",
    "transition_refund_status",
    "review_compliance_document",
    "set_branch_setting",
    "set_platform_setting",
    "create_access_invitation",
    "transition_settlement_status",
  ];
  for (const routine of routines) {
    const start = schema.indexOf(`create or replace function public.${routine}`);
    assert.notEqual(start, -1, `${routine} is missing`);
    const body = schema.slice(start, schema.indexOf("$$;", start));
    assert.match(body, /security definer/, `${routine} must run at the database boundary`);
    assert.match(body, /auth\.uid\(\)/, `${routine} must identify the authenticated caller`);
    assert.match(schema, new RegExp(`revoke all on function public\\.${routine}\\(`), `${routine} must be revoked before its narrow grant`);
  }
  assert.match(schema, /Only mock refunds are supported/);
  assert.match(schema, /'transferred_real_money', false/);
  assert.match(schema, /create policy compliance_scoped_delete/);
});

test("admin and superadmin interfaces call the secured workflows", async () => {
  const source = await readFile(new URL("app/components/operator-features.tsx", root), "utf8");
  for (const rpc of ["assign_trip_resources", "request_refund", "transition_refund_status", "create_support_case", "review_compliance_document", "set_branch_setting", "set_platform_setting", "create_access_invitation", "transition_settlement_status"]) {
    assert.match(source, new RegExp(`rpc\\("${rpc}"`), `${rpc} is not connected to the UI`);
  }
  assert.match(source, /storage\.from\("compliance-documents"\)\.upload/);
  assert.match(source, /from\("support_messages"\)\.insert/);
  assert.match(source, /No real money was transferred/);
});

test("passenger flow supports promotions, refunds, support, and detailed tickets", async () => {
  const source = await readFile(new URL("app/components/passenger-live.tsx", root), "utf8");
  assert.match(source, /promotion_code: promoCode\.trim\(\) \|\| null/);
  assert.doesNotMatch(source, /promotion_code: null/);
  assert.match(source, /rpc\("request_refund"/);
  assert.match(source, /trip:trips\(departure_at,arrival_at,gate/);
  assert.match(source, /Gate \{booking\.trip\.gate \|\| "TBA"\}/);

  const shell = await readFile(new URL("app/components/shells.tsx", root), "utf8");
  assert.match(shell, /"\/passenger\/support"/);
});
