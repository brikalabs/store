import { useCallback, useEffect, useState } from "react";

/** A scope the signed-in user belongs to, with their role and the verified display name. */
export type MemberScope = {
  scope: string;
  role: "admin" | "member";
  displayName?: string | null;
};

/**
 * The scopes the signed-in user belongs to (`GET /api/scopes`), with a `reload` for after a claim
 * or membership change. `null` until the first read resolves; a failed read degrades to an empty
 * list. Shared by the scopes list and the per-scope role checks below.
 */
export function useScopes(): { scopes: MemberScope[] | null; reload: () => void } {
  const [scopes, setScopes] = useState<MemberScope[] | null>(null);
  const reload = useCallback(() => {
    fetch("/api/scopes")
      .then((res) => res.json() as Promise<{ scopes?: MemberScope[] }>)
      .then((data) => setScopes(data.scopes ?? []))
      .catch(() => setScopes([]));
  }, []);
  useEffect(reload, [reload]);
  return { scopes, reload };
}

/** Whether the signed-in user is an admin of `scope` (false while loading or not a member). */
export function useIsScopeAdmin(scope: string | null): boolean {
  const { scopes } = useScopes();
  if (scope === null || scopes === null) return false;
  return scopes.find((s) => s.scope === scope)?.role === "admin";
}
