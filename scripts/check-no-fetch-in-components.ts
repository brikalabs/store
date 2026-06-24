#!/usr/bin/env bun
/**
 * No-fetch-in-components guard (ADR-0005). A component is a view: container-or-presentational. Data
 * access (the fetch, the mutations) lives in a `use-*` hook, never inline in a `.tsx`. Without a gate
 * this rots - the app had grown 24 components calling `fetch()` next to their JSX, welding data logic
 * to rendering. archunit can't see a global call like `fetch(` (it is not an import), so this is a
 * small script gate, like the thin-routes one. A failure points the author at the hooks layer.
 */
import { readFileSync } from "node:fs";
import { Glob } from "bun";

const COMPONENTS_GLOB = "apps/web/src/components/**/*.tsx";
const violations: string[] = [];

for (const path of new Glob(COMPONENTS_GLOB).scanSync(".")) {
  if (path.endsWith(".test.tsx")) continue; // a test may stub fetch
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, ""); // ignore line comments
    if (/\bfetch\(/.test(code)) violations.push(`${path}:${index + 1}`);
  });
}

if (violations.length > 0) {
  console.error(
    `check:no-fetch-in-components: ${violations.length} component(s) call fetch() directly. Move the data access into a use-* hook (ADR-0005):`,
  );
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("check:no-fetch-in-components: no component calls fetch() directly (data lives in hooks).");
