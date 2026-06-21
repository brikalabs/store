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
  const head = base.replace(/\/+$/, "");
  const tail = segments.map((s) => s.replace(/^\/+|\/+$/g, "")).filter((s) => s.length > 0);
  return [head, ...tail].join("/");
}
