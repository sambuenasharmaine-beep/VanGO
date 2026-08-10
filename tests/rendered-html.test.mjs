import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the VanGO entry experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Your next journey starts here/);
  assert.match(html, /Search trips/);
  assert.match(html, /Mock Payment/);
  assert.doesNotMatch(html, /Choose your workspace/);
  assert.doesNotMatch(html, /Open admin|Open platform/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders every passenger, admin, and superadmin route", async () => {
  const paths = [
    "/passenger", "/passenger/trips", "/passenger/seats", "/passenger/checkout", "/passenger/bookings", "/passenger/ticket", "/passenger/profile", "/passenger/alerts", "/passenger/support",
    "/admin", "/admin/bookings", "/admin/trips", "/admin/assignments", "/admin/schedules", "/admin/schedule-rules", "/admin/schedule-exceptions", "/admin/fleet", "/admin/drivers", "/admin/customers", "/admin/payments", "/admin/refunds", "/admin/promotions", "/admin/support", "/admin/reports", "/admin/settings",
    "/superadmin", "/superadmin/organizations", "/superadmin/branches", "/superadmin/terminals", "/superadmin/bookings", "/superadmin/access", "/superadmin/invitations", "/superadmin/access-reviews", "/superadmin/finance", "/superadmin/refunds", "/superadmin/compliance", "/superadmin/support", "/superadmin/integrations", "/superadmin/audit", "/superadmin/health", "/superadmin/configuration",
  ];

  for (const path of paths) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /VanGO/);
    assert.doesNotMatch(html, /Sambuena/i);
  }
});
