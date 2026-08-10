import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../supabase/vango_full_schema.sql", import.meta.url);

/**
 * The bootstrap is pasted into the Supabase SQL editor as a single batch, so one
 * malformed statement rejects the entire database setup. This walks the file the
 * way the server does: dollar-quoted function bodies and string literals are
 * skipped, and every `;` must land at parenthesis depth zero.
 */
function unbalancedStatements(sql) {
  const lines = sql.split(/\r?\n/);
  const problems = [];
  let depth = 0;
  let inDollarQuote = false;
  let inStringLiteral = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (let position = 0; position < line.length; position += 1) {
      if (!inStringLiteral && line.slice(position, position + 2) === "$$") {
        inDollarQuote = !inDollarQuote;
        position += 1;
        continue;
      }
      if (inDollarQuote) continue;
      const character = line[position];
      if (character === "'") {
        inStringLiteral = !inStringLiteral;
        continue;
      }
      if (inStringLiteral) continue;
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
      else if (character === ";") {
        if (depth !== 0) problems.push({ line: index + 1, depth });
        depth = 0;
      }
    }
  }
  return { problems, inDollarQuote };
}

test("every bootstrap statement parses as one balanced batch", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  const { problems, inDollarQuote } = unbalancedStatements(schema);

  assert.deepEqual(problems, [], `unbalanced parentheses at ${JSON.stringify(problems)}`);
  assert.equal(inDollarQuote, false, "a dollar-quoted function body was left open");
});

test("hardened functions never call an extension-schema function unqualified", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  // Every routine runs with `set search_path = ''`, so pgcrypto helpers living
  // in the extensions schema would not resolve at runtime.
  assert.doesNotMatch(schema, /create extension if not exists pgcrypto/);
  assert.doesNotMatch(schema, /gen_random_bytes\(/, "gen_random_bytes is pgcrypto-only");
  assert.doesNotMatch(schema, /[^.]\bdigest\(/, "digest is pgcrypto-only; use the built-in sha256");
  assert.match(schema, /encode\(sha256\(convert_to\(/);
});

test("passenger visibility does not weaken staff tenant isolation", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  assert.match(schema, /create policy routes_public_select on public\.routes for select to anon using/);
  assert.match(schema, /create policy routes_passenger_select on public\.routes for select to authenticated/);
  assert.match(schema, /create policy trips_public_select on public\.trips for select to anon using/);
  assert.match(schema, /create policy trips_passenger_select on public\.trips for select to authenticated/);
  assert.match(schema, /not public\.has_active_staff_membership\(\)/);
  assert.match(schema, /create policy trips_scoped_select/);
});

test("creating a trip generates its seat inventory", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  assert.match(schema, /create or replace function public\.sync_trip_seats/);
  assert.match(schema, /create trigger trips_sync_seats/);
  assert.match(schema, /after insert or update of capacity on public\.trips/);
  assert.match(schema, /Capacity cannot remove a sold or actively held seat/);
  assert.match(schema, /substring\(ts\.seat_code from '\^\[0-9\]\+'/);
});

test("staff table writes are audited by the database itself", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  assert.match(schema, /create or replace function public\.log_audit_event/);
  assert.match(schema, /create trigger %I_audit after insert or update or delete/);
  assert.match(schema, /create trigger trips_audit_update/);
  assert.match(schema, /'secret_reference', 'token_hash', 'value'/);
  assert.match(schema, /revoke all on function public\.log_audit_event\(\) from public, anon, authenticated/);
});

test("the shared tables are published to Realtime", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  const publication = schema.slice(schema.indexOf("supabase_realtime"));

  for (const table of ["trips", "trip_seats", "seat_holds", "bookings", "notifications", "support_cases"]) {
    assert.match(publication, new RegExp(`'${table}'`), `${table} is not streamed to Realtime`);
  }
  assert.match(publication, /alter publication supabase_realtime add table/);
  assert.match(publication, /replica identity full/);
  assert.match(schema, /update public\.trips set updated_at = now\(\) where id = target_trip_id/);
});

test("privileged RPCs still refuse anonymous callers", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  for (const routine of ["hold_trip_seats", "release_seat_hold", "quote_booking", "confirm_booking", "complete_mock_payment"]) {
    const start = schema.indexOf(`create or replace function public.${routine}`);
    assert.notEqual(start, -1, `${routine} is missing`);
    const body = schema.slice(start, schema.indexOf("$$;", start));
    assert.match(body, /security definer/, `${routine} must be security definer`);
    assert.match(body, /if caller is null then raise exception 'Authentication required'/, `${routine} must reject anonymous callers`);
  }
});

test("trip, route, and branch scope cannot be mixed across organizations", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  assert.match(schema, /unique \(id, organization_id\)/);
  assert.match(schema, /foreign key \(branch_id, organization_id\) references public\.branches\(id, organization_id\)/);
  assert.match(schema, /foreign key \(route_id, organization_id\) references public\.routes\(id, organization_id\)/);
  assert.match(schema, /foreign key \(trip_id, organization_id, branch_id\) references public\.trips\(id, organization_id, branch_id\)/);
});

test("staff setup can select registered users without copying Auth UUIDs", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  const accessPage = await readFile(new URL("../app/superadmin/access/page.tsx", import.meta.url), "utf8");

  assert.match(schema, /insert into public\.profiles \(id, email, full_name, mobile_e164\)/);
  assert.match(accessPage, /reference: \{ table: "profiles", labelColumns: \["full_name", "email"\] \}/);
});
