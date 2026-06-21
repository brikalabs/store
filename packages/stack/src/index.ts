/**
 * Best-effort source-location helpers over `Error.stack`. Diagnostics only: they show source
 * paths in dev/tests and in source-mapped builds, and degrade to `undefined`/`""` when a stack
 * is unavailable or in an unexpected format - never throwing. Shared by `@brika/router` (naming a
 * route by where it was defined) and `@brika/di` (naming a token by its declaration site), so the
 * V8 frame parsing lives in one place rather than copied into each.
 */

/** Extract a `file:line:col` from one stack frame (V8 `(path:1:2)` or `at path:1:2`). */
export function frameLocation(frame: string): string | undefined {
  const inParens = /\(([^()]+)\)\s*$/.exec(frame);
  const loc = inParens?.[1] ?? /\bat\s+(.+?)\s*$/.exec(frame)?.[1];
  return loc?.replace(/^file:\/\//, "");
}

/**
 * The first real (non-`node:`, non-`<anonymous>`) frame's FILE in `stack`, with the trailing
 * `:line:col` stripped, or `""` when none is found. Capture it from a load-time `new Error().stack`
 * to learn a module's own file, so {@link callerFrame} can later skip that module's frames.
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
 * The first real frame's `file:line:col` in `stack` that is NOT in `selfFile` (nor a `node:` /
 * `<anonymous>` frame), or `undefined`. With `selfFile` set to the calling module's own file (from
 * {@link moduleFile}), this is "where my caller is" - the declaration site of a route or token.
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
