/**
 * Best-effort source-location helpers over `Error.stack`. Diagnostics only: they degrade to
 * `undefined`/`""` rather than throw. Shared by `@brika/router` and `@brika/di` so the V8 frame
 * parsing lives in one place.
 */

/**
 * Extract a `file:line:col` from one stack frame (V8 `at fn (path:1:2)` or `at path:1:2`).
 * String-scanned, not regex-matched, to stay linear (no backtracking) on any frame text.
 */
export function frameLocation(frame: string): string | undefined {
  const trimmed = frame.trim();
  if (trimmed.endsWith(")")) {
    const open = trimmed.lastIndexOf("(");
    if (open !== -1) return stripFileScheme(trimmed.slice(open + 1, -1));
  }
  if (trimmed.startsWith("at ")) return stripFileScheme(trimmed.slice(3).trim());
  return undefined;
}

/** Drop a leading `file://` from a location, leaving a plain path. */
function stripFileScheme(loc: string): string {
  return loc.startsWith("file://") ? loc.slice(7) : loc;
}

/**
 * The first real frame's FILE in `stack` (`:line:col` stripped), or `""`. Capture from a load-time
 * `new Error().stack` to learn a module's own file, so {@link callerFrame} can skip that module's frames.
 */
export function moduleFile(stack: string | undefined): string {
  for (const frame of (stack ?? "").split("\n")) {
    const loc = frameLocation(frame);
    if (loc !== undefined && !loc.includes("node:") && !loc.includes("<anonymous>")) {
      return loc.replace(/:\d+(:\d+)?$/, "");
    }
  }
  return "";
}

/**
 * The first real frame's `file:line:col` in `stack` not in `selfFile`, or `undefined`. With `selfFile`
 * from {@link moduleFile}, this is "where my caller is" - the declaration site of a route or token.
 */
export function callerFrame(stack: string | undefined, selfFile: string): string | undefined {
  for (const frame of (stack ?? "").split("\n")) {
    const loc = frameLocation(frame);
    if (loc === undefined || loc.includes("node:") || loc.includes("<anonymous>")) continue;
    if (selfFile !== "" && loc.includes(selfFile)) continue;
    return loc;
  }
  return undefined;
}
