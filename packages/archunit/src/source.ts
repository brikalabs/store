/** Source-text parsing: extract the facts rules assert over (imports, declared classes). */

/** Strip block + line comments so an `import ... from "x"` inside a comment is not counted. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Every import/export module specifier in a source file (comments should be stripped first). */
export function specifiers(source: string): string[] {
  const out: string[] = [];
  // `[\s(]*` (not `\s*\(?\s*`) so the whitespace runs can't overlap and backtrack.
  const re = /\b(?:from|import)\b[\s(]*["']([^"']+)["']/g;
  let match = re.exec(source);
  while (match !== null) {
    if (match[1] !== undefined) out.push(match[1]);
    match = re.exec(source);
  }
  return out;
}

/**
 * Every declared class name in a source file (`class X`, `export [default] [abstract] class X`).
 * Anchored to statement position (a declaration starts its line) so the word "class" inside a
 * string or template - e.g. `` `declares class ${name}` `` - is not mistaken for a declaration.
 */
export function classNames(source: string): string[] {
  const out: string[] = [];
  // Indentation/spacing is `[ \t]` (not `\s`), so no whitespace run spans a newline or
  // overlaps the next - each run is fenced by a literal keyword, leaving nothing to backtrack.
  const re =
    /(?:^|\n)[ \t]*(?:export[ \t]+)?(?:default[ \t]+)?(?:abstract[ \t]+)?class[ \t]+([A-Za-z_$][\w$]*)/g;
  let match = re.exec(source);
  while (match !== null) {
    if (match[1] !== undefined) out.push(match[1]);
    match = re.exec(source);
  }
  return out;
}
