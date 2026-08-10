import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const roots = [new URL("../app/", import.meta.url), new URL("../lib/", import.meta.url)];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...(await sourceFiles(child)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(child);
  }
  return files;
}

async function readSources() {
  const files = (await Promise.all(roots.map(sourceFiles))).flat();
  return Promise.all(files.map(async (file) => ({ file, text: await readFile(file, "utf8") })));
}

test("no synthetic workspace or demo-mode fallback ships in the client", async () => {
  const sources = await readSources();

  // A previous build rendered a "DEMO DATA / local synthetic workspace" screen
  // whenever Supabase was unconfigured. Every workspace must show a real empty
  // state or the setup notice instead, never invented records.
  const banned = [/DEMO DATA/i, /synthetic/i, /\bVG-DEMO\b/i, /sampleBookings/, /mockRows/, /fakeData/];
  for (const { file, text } of sources) {
    for (const pattern of banned) {
      assert.doesNotMatch(text, pattern, `${file.pathname} contains demo content matching ${pattern}`);
    }
  }
});

test("passenger and console screens read their rows from Supabase", async () => {
  const sources = await readSources();
  const byName = new Map(sources.map(({ file, text }) => [file.pathname.split("/").pop(), text]));

  for (const component of ["passenger-live.tsx", "live-console.tsx", "public-booking.tsx"]) {
    const text = byName.get(component);
    assert.ok(text, `${component} is missing`);
    assert.match(text, /getSupabaseBrowserClient\(\)/, `${component} must query Supabase`);
    // A literal array of records in a view component is a seeded table.
    assert.doesNotMatch(text, /=\s*\[\s*\{\s*(id|reference|full_name)\s*:/, `${component} declares a hardcoded record list`);
  }
});

test("the passenger app is laid out for desktop as well as mobile", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // Below this breakpoint the shell is a full-bleed mobile app; above it the
  // 430px phone frame must give way to a real page.
  assert.match(css, /@media \(min-width: 701px\)/);
  const desktop = css.slice(css.indexOf("@media (min-width: 701px)"));
  assert.match(desktop, /\.passenger-frame \{[^}]*width: min\(100%, 1060px\)/);
  assert.match(desktop, /\.passenger-tabs \{[^}]*position: static/);
  assert.match(desktop, /\.passenger-booking-grid \{[^}]*repeat\(auto-fill, minmax\(320px, 1fr\)\)/);
});

test("responsive controls keep data and tap targets usable", async () => {
  const [css, consoleSource] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/live-console.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(consoleSource, /className="row-tools"/);
  assert.doesNotMatch(css, /\.data-row > span:last-child \{ position: absolute/);
  assert.match(css, /\.data-row > span\.row-delete \{ position: absolute/);
  assert.match(css, /\.data-row > span\.row-actions, \.data-row > span\.row-tools/);
  assert.match(css, /\.data-row \.row-action, \.data-row \.status-action \{ min-height: 40px/);
  assert.match(css, /\.booking-search-form \.booking-field:nth-of-type\(4\) \{ grid-column: 3/);
  assert.match(css, /\.booking-search-form \.booking-field:nth-of-type\(3\), \.booking-search-form \.booking-field:nth-of-type\(4\) \{ grid-column: 1 \/ -1/);
  assert.match(css, /\.alert-list article \{[^}]*grid-template-columns: 10px minmax\(0, 1fr\)/);
});
