import type { MarkerKindSpec, Severity } from "./types";

/**
 * The built-in marker kinds (defaults). A repo can edit or extend them with a
 * `markers.config.json` at its root, which overlays this list by name (see
 * `./config.ts`). The parser, CLI, and editor read the resolved kinds; the
 * package README explains what each kind means.
 *
 * Write markers as `// @kind: reason` comments; for a synthesized value, mark
 * the function that produces it rather than each field it returns.
 */
function kind(
  name: string,
  title: string,
  severity: Severity,
  description: string,
): MarkerKindSpec {
  return { name, title, severity, description, ignore: [] };
}

export const KINDS: readonly MarkerKindSpec[] = [
  kind("mock", "Mock data", "info", "Stand-in data shown until the real source is wired."),
  kind("stub", "Stub", "warning", "Placeholder behaviour that is not real logic yet."),
  kind("unenforced", "Unenforced", "warning", "A rule declared before it is enforced in code."),
  kind("todo", "Todo", "info", "Planned work that is not built yet."),
  kind("hack", "Hack", "warning", "A shortcut that works but should be revisited."),
  kind("fixme", "Fixme", "warning", "A known defect that needs a real fix."),
];

/** Lookup a kind by its source name. */
export function kindByName(name: string): MarkerKindSpec | undefined {
  return KINDS.find((entry) => entry.name === name);
}
