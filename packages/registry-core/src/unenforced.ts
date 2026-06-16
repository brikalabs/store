/**
 * Mark a value as declared but not yet enforced. At runtime this is the identity
 * function (it returns `value` untouched); its purpose is to be a real, typed,
 * greppable annotation rather than a comment. Compared with a `// @unenforced`
 * comment it:
 *   - requires a `reason`, so the gap is always explained at the call site;
 *   - is seen by the compiler and by IDE "find all references" with no plugin;
 *   - is listed by `bun run unenforced` alongside the comment form.
 *
 * Use the `// @unenforced: reason` comment instead when there is no value to wrap
 * (for example a check that is simply missing). See docs/CONVENTIONS.md.
 *
 * @example
 * maxFileBytes: unenforced(8 * MiB, "needs tar inspection in the manifest gate"),
 */
export function unenforced<T>(value: T, _reason: string): T {
  return value;
}
