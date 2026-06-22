import type { MarkerKindSpec, Severity } from "./types";

/**
 * The built-in marker kinds (defaults); a repo can overlay them by name via `markers.config.json`.
 * Write markers as `// @kind: reason`; for a synthesized value, mark the function that produces it.
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
