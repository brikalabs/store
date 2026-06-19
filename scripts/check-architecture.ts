/**
 * Architecture rules, enforced. Clean/hexagonal layering is only real if it cannot
 * silently regress, so this guards the Dependency Rule with a few import checks (run in
 * `bun run lint`, like check-no-em-dash). The rules, in one line each:
 *
 *   A. The domain core (@brika/registry-core) depends on NOTHING platform-specific:
 *      no Cloudflare, no database/ORM, no HTTP framework. It speaks only ports.
 *   B. The router (@brika/router) is platform-free too (Hono is allowed - it wraps it).
 *   C. Inside the registry app, the DATABASE is reached only through adapters + the
 *      composition root - controllers/auth/etc. go through ports on `ctx`, never `db`.
 *
 * Tests are exempt (they legitimately seed the database with in-memory fakes).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

/** Every import/export specifier in a source file. */
function specifiers(source: string): string[] {
  const out: string[] = [];
  const re = /\b(?:from|import)\b\s*\(?\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null = re.exec(source);
  while (match !== null) {
    if (match[1] !== undefined) out.push(match[1]);
    match = re.exec(source);
  }
  return out;
}

const isPlatform = (s: string): boolean =>
  s.startsWith("cloudflare:") || s.startsWith("@cloudflare/") || s === "wrangler";
const isOrm = (s: string): boolean =>
  s === "drizzle-orm" || s.startsWith("drizzle-orm/") || s === "@brika/store-db";
const isHttp = (s: string): boolean =>
  s === "hono" || s.startsWith("hono/") || s === "@brika/router" || s.startsWith("@brika/router/");

const isTest = (rel: string): boolean => /\.(test|spec)\.tsx?$/.test(rel) || rel.includes("test-harness");

interface Rule {
  readonly name: string;
  readonly dir: string;
  /** Files (relative to ROOT) this rule applies to. */
  readonly applies: (rel: string) => boolean;
  /** Returns a reason when `spec` is banned for this file, else null. */
  readonly banned: (spec: string) => string | null;
}

const RULES: Rule[] = [
  {
    name: "A. domain core is platform-free (@brika/registry-core)",
    dir: "packages/registry-core/src",
    applies: () => true,
    banned: (s) => {
      if (isPlatform(s)) return "a Cloudflare/platform module";
      if (isOrm(s)) return "the database/ORM";
      if (isHttp(s)) return "an HTTP framework/router";
      return null;
    },
  },
  {
    name: "B. router is platform-free (@brika/router)",
    dir: "packages/router/src",
    applies: () => true,
    banned: (s) => {
      if (isPlatform(s)) return "a Cloudflare/platform module";
      if (isOrm(s)) return "the database/ORM";
      return null;
    },
  },
  {
    name: "C. the database is reached only through adapters + the composition root",
    dir: "apps/registry/src",
    // Allowed to touch the DB: the adapters, the composition root (services.ts/index.ts),
    // the shared test harness, and tests.
    applies: (rel) =>
      !isTest(rel) &&
      !rel.includes("/adapters/") &&
      !rel.endsWith("/services.ts") &&
      !rel.endsWith("/index.ts"),
    banned: (s) => (isOrm(s) ? "the database/ORM (use a port on `ctx`)" : null),
  },
];

function tsFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  return readdirSync(abs, { recursive: true })
    .map((entry) => join(dir, entry.toString()))
    .filter((rel) => /\.tsx?$/.test(rel));
}

const violations: string[] = [];
for (const rule of RULES) {
  for (const rel of tsFiles(rule.dir)) {
    if (!rule.applies(rel)) continue;
    const source = readFileSync(join(ROOT, rel), "utf8");
    for (const spec of specifiers(source)) {
      const reason = rule.banned(spec);
      if (reason !== null) {
        violations.push(`  [${rule.name}]\n    ${relative(ROOT, join(ROOT, rel))} imports "${spec}" (${reason})`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`check-architecture: ${violations.length} rule violation(s):\n${violations.join("\n")}`);
  process.exit(1);
}
console.log("check-architecture: all architecture rules hold.");
