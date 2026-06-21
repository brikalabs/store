/**
 * Join a base URL (or path) with one or more path segments into a single URL, collapsing the slashes
 * at each boundary so there is never a duplicate `//` or a missing separator. Slashes WITHIN a
 * segment are kept (e.g. a multi-part object key like `user-avatars/x.webp`), and the scheme's `://`
 * is preserved. A trailing slash on the base is ignored. Empty segments are dropped.
 *
 *   joinUrl("https://cdn.example.com/", "/user-avatars", "x.webp")
 *     -> "https://cdn.example.com/user-avatars/x.webp"
 */
export function joinUrl(base: string, ...segments: string[]): string {
  const head = trimSlashes(base, "end");
  const tail = segments.map((s) => trimSlashes(s, "both")).filter((s) => s.length > 0);
  return [head, ...tail].join("/");
}

/**
 * Drop a run of `/` from the end (and, when `sides` is "both", the start) of `s`. A plain scan
 * rather than a `/\/+$/`-style regex, so there is no quantifier-before-anchor for a backtracking
 * check to flag and the work stays linear in the input length.
 */
function trimSlashes(s: string, sides: "both" | "end"): string {
  let start = 0;
  let end = s.length;
  if (sides === "both") while (start < end && s[start] === "/") start += 1;
  while (end > start && s[end - 1] === "/") end -= 1;
  return s.slice(start, end);
}
