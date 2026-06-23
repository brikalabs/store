import { useCallback, useState } from "react";

/** A labelled link as the profile/scope APIs store it. */
export type ProfileLink = { label: string; url: string };

/** A link row carrying a stable client id, so React keys survive add/remove/edit. */
export type EditLink = ProfileLink & { id: string };

let seq = 0;
function stamp(link: ProfileLink): EditLink {
  seq += 1;
  return { ...link, id: `link-${seq}` };
}

/**
 * Editable labelled-link rows with stable ids and add/update/remove/reset. The profile editor and
 * the scope profile card share this state model (their row markup differs, by design, so only the
 * logic is shared). Pair with {@link cleanLinks} before saving.
 */
export function useLinks(initial: readonly ProfileLink[] = []): {
  links: EditLink[];
  add: () => void;
  update: (id: string, patch: Partial<ProfileLink>) => void;
  remove: (id: string) => void;
  reset: (next: readonly ProfileLink[]) => void;
} {
  // initial is only read once (lazy initializer); subsequent hydration goes through `reset`.
  const [links, setLinks] = useState<EditLink[]>(() => initial.map(stamp));
  // Memoized so callers can safely depend on them (e.g. `reset` in a hydration effect).
  const add = useCallback(() => setLinks((cur) => [...cur, stamp({ label: "", url: "" })]), []);
  const update = useCallback(
    (id: string, patch: Partial<ProfileLink>) =>
      setLinks((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    [],
  );
  const remove = useCallback((id: string) => setLinks((cur) => cur.filter((l) => l.id !== id)), []);
  const reset = useCallback((next: readonly ProfileLink[]) => setLinks(next.map(stamp)), []);
  return { links, add, update, remove, reset };
}

/** Trim and drop incomplete rows - the profile/scope APIs reject partial links. */
export function cleanLinks(links: readonly ProfileLink[]): ProfileLink[] {
  return links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter((l) => l.label.length > 0 && l.url.length > 0);
}
