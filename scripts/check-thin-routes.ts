#!/usr/bin/env bun
/**
 * Thin-route guard for the web app.
 *
 * TanStack's file-based routing means `apps/web/src/routes/**` is a layer boundary: a route
 * file should only WIRE a URL to the layers below (a `createFileRoute(...)` with its loader /
 * `beforeLoad` / search-schema and a delegating `component`). UI belongs in `components/`, data
 * access in stores/services, pure helpers in `lib/`. Without a gate that rule rots - `$.tsx`
 * had grown to 1241 lines / ~35 inline components.
 *
 * So every route file (except the generated route tree) must be <= MAX_LINES lines and export
 * exactly one symbol, `Route`. A failure points the author at the component / lib / store layer.
 * Biome and archunit can't express "<= N lines, single named export", so this is a small gate.
 */
import { readFileSync } from "node:fs";
import { Glob } from "bun";

const MAX_LINES = 80;
const ROUTES_GLOB = "apps/web/src/routes/**/*.{ts,tsx}";
const GENERATED = "routeTree.gen.ts";

const violations: string[] = [];
for (const path of new Glob(ROUTES_GLOB).scanSync(".")) {
  if (path.endsWith(GENERATED)) continue;
  const lines = readFileSync(path, "utf8").split("\n");
  const lineCount = lines.at(-1) === "" ? lines.length - 1 : lines.length;
  // Match any export form, not just `export ` at column 0: catches an indented export, an
  // `export{x}`/`export*` with no following space, and `export type`/`export default` - so a
  // second export cannot slip back into a route past a text-prefix check.
  const exports = lines.filter((line) => /^\s*export\b/.test(line));
  if (lineCount > MAX_LINES) {
    violations.push(`${path}: ${lineCount} lines (max ${MAX_LINES}) - extract UI/logic to a layer below`);
  }
  if (exports.length !== 1 || !/^export const Route\b/.test(exports[0]?.trim() ?? "")) {
    const found = exports.map((line) => line.trim()).join("; ") || "none";
    violations.push(`${path}: must export only \`Route\` (found: ${found})`);
  }
}

if (violations.length === 0) {
  console.log("check:thin-routes: every route file is thin (<= 80 lines, exports only `Route`).");
  process.exit(0);
}

console.error(
  "Route files must stay thin: <= 80 lines and export only `Route`.\n" +
    "Push UI into components/, data access into a store/service, pure helpers into lib/.\n",
);
for (const violation of violations) console.error(`  ${violation}`);
process.exit(1);
