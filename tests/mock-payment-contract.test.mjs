import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../supabase/vango_full_schema.sql", import.meta.url);
const envUrl = new URL("../.env.example", import.meta.url);

test("database accepts only the VanGO mock payment mode", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  assert.match(schema, /provider text not null default 'mock' check \(provider = 'mock'\)/);
  assert.match(schema, /method text not null default 'mock_payment' check \(method = 'mock_payment'\)/);
  assert.match(schema, /create or replace function public\.complete_mock_payment/);
  assert.match(schema, /'charged_real_money', false/);
  assert.match(schema, /on conflict \(idempotency_key\) do update/);
  assert.doesNotMatch(schema, /checkout_url/);
});

test("local environment requires no financial-provider secret", async () => {
  const example = await readFile(envUrl, "utf8");

  assert.doesNotMatch(example, /PAYMENT_[A-Z_]*SECRET/);
  assert.match(example, /Mock payment requires no financial-provider credentials/);
});
