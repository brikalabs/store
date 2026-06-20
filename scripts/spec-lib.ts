/**
 * Shared loader for the docs-as-code spec system. Walks the per-spec markdown files
 * under docs/specs/<group>/, parses their YAML frontmatter (id, title, status, area,
 * group, test_mode) and the acceptance-criterion codes in the body, and returns a typed
 * list. Used by spec-coverage.ts (test linkage) and gen-spec-index.ts (the registry).
 *
 * Frontmatter is parsed with a tiny purpose-built reader (no YAML dependency): the schema
 * is fixed and flat, so we only read the keys we define.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..");
export const SPECS_DIR = join(ROOT, "docs/specs");

export const STATUSES = ["done", "wip", "todo", "hold", "gone"] as const;
export type Status = (typeof STATUSES)[number];

export interface Spec {
  id: string;
  title: string;
  status: Status;
  area: string;
  group: string;
  testMode: string;
  file: string; // path relative to repo root
  criteria: string[]; // AC codes in the body
}

const AC_CODE = /\b([A-Z]+-\d+-AC\d+)\b/g;

function frontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text.startsWith("---")) return out;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return out;
  for (const line of text.slice(3, end).split("\n")) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Titles are stored JSON-quoted in frontmatter (to allow colons); decode safely. */
function parseTitle(raw: string): string {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.replace(/^"|"$/g, "");
    }
  }
  return raw;
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith(".md") && !entry.startsWith("_")) files.push(full);
  }
  return files;
}

/** Load every per-spec file (the ones with a frontmatter `id`). */
export function loadSpecs(): Spec[] {
  const specs: Spec[] = [];
  for (const full of walk(SPECS_DIR)) {
    const text = readFileSync(full, "utf8");
    const fm = frontmatter(text);
    if (fm.id === undefined) continue; // README/INDEX/_template have no id
    const status = (STATUSES as readonly string[]).includes(fm.status)
      ? (fm.status as Status)
      : "todo";
    const criteria = [...new Set([...text.matchAll(AC_CODE)].map((m) => m[1]))].filter((c) =>
      c.startsWith(fm.id),
    );
    specs.push({
      id: fm.id,
      title: parseTitle(fm.title ?? ""),
      status,
      area: fm.area ?? "",
      group: fm.group ?? "misc",
      testMode: fm.test_mode ?? "none",
      file: full.slice(ROOT.length + 1),
      criteria,
    });
  }
  return specs.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** AC codes cited in the test suites (a test "covers" a criterion by naming its code). */
export async function citedInTests(): Promise<Set<string>> {
  const { Glob } = await import("bun");
  const cited = new Set<string>();
  for (const pattern of ["**/*.test.ts", "apps/web/e2e/**/*.spec.ts"]) {
    for await (const rel of new Glob(pattern).scan({ cwd: ROOT })) {
      if (rel.includes("node_modules")) continue;
      for (const m of readFileSync(join(ROOT, rel), "utf8").matchAll(AC_CODE)) cited.add(m[1]);
    }
  }
  return cited;
}

export const STATUS_LABEL: Record<Status, string> = {
  done: "[DONE]",
  wip: "[WIP]",
  todo: "[TODO]",
  hold: "[HOLD]",
  gone: "[GONE]",
};
