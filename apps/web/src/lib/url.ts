/** Join a base URL/path with path segments, collapsing boundary slashes (no duplicate `//`,
 * no missing separator). Slashes within a segment and the scheme's `://` are preserved. */
export function joinUrl(base: string, ...segments: string[]): string {
  const head = trimSlashes(base, "end");
  const tail = segments.map((s) => trimSlashes(s, "both")).filter((s) => s.length > 0);
  return [head, ...tail].join("/");
}

// A plain scan rather than a `/\/+$/`-style regex: no backtracking, linear in input length.
function trimSlashes(s: string, sides: "both" | "end"): string {
  let start = 0;
  let end = s.length;
  if (sides === "both") while (start < end && s[start] === "/") start += 1;
  while (end > start && s[end - 1] === "/") end -= 1;
  return s.slice(start, end);
}
