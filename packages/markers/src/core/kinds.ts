import type { MarkerKindSpec } from "./types";

/**
 * The built-in marker kinds. These are the defaults; a repo can edit or extend
 * them with a `markers.config.json` at its root, which overlays this list by name
 * (see `./config.ts`). The parser builds its patterns from the resolved kinds,
 * the CLI groups by them, the editor colours diagnostics by them.
 *
 * Markers are written as `// @kind: reason` comments placed on, or just above,
 * the spot they describe. For a synthesized value, mark the function that
 * produces it (one marker) rather than each field it returns.
 */
export const KINDS: readonly MarkerKindSpec[] = [
  {
    name: "mock",
    title: "Mock data",
    // Fake *data* the UI shows so a screen renders fully before the real source
    // exists. The shape is real; the values are invented. Delete once wired.
    description: "Synthesized stand-in data shown until the real source is wired (then delete it).",
    severity: "info",
    ignore: [],
  },
  {
    name: "stub",
    title: "Stub",
    // Missing *behaviour*, not data: a handler that returns a canned result, a
    // no-op where real logic belongs. Distinct from `mock` (which is data).
    description: "Placeholder implementation/behaviour that is not real logic yet.",
    severity: "warning",
    ignore: [],
  },
  {
    name: "unenforced",
    title: "Unenforced",
    // A documented guarantee with no real check behind it yet, kept honest so a
    // declared limit/rule never reads as if it is actually enforced.
    description: "A limit, rule, or contract field declared before it is enforced in code.",
    severity: "warning",
    ignore: [],
  },
  {
    name: "todo",
    title: "Todo",
    description: "Planned work that is not built yet.",
    severity: "info",
    ignore: [],
  },
  {
    name: "hack",
    title: "Hack",
    // It works, but it is the wrong way: a shortcut, a workaround, something to
    // come back and do properly.
    description: "A deliberate shortcut that works but should be revisited.",
    severity: "warning",
    ignore: [],
  },
  {
    name: "fixme",
    title: "Fixme",
    // It is wrong: a known defect or fragile spot that needs a real fix, not
    // just tidying.
    description: "A known defect: code that is wrong or fragile and needs a real fix.",
    severity: "warning",
    ignore: [],
  },
];

/** Lookup a kind by its source name. */
export function kindByName(name: string): MarkerKindSpec | undefined {
  return KINDS.find((kind) => kind.name === name);
}
