import { useCallback, useState } from "react";

/** The outcome of a claim: success, or the message to surface inline on the form. */
export type ClaimResult = { ok: true } | { ok: false; error: string };

/**
 * Claim a scope for the signed-in user (`PUT /api/scopes/{scope}`), so the page stays
 * presentational. The scopes list is page-owned (the shared `useScopes` hook), so on success this
 * refreshes through that page's `onReload`. `claim` resolves to a typed result: the form clears its
 * input on `ok`, or shows `error` (the API message, with the claim-specific fallback) otherwise.
 */
export function useClaimScope(onReload: () => void) {
  const [busy, setBusy] = useState(false);

  const claim = useCallback(
    async (scope: string): Promise<ClaimResult> => {
      setBusy(true);
      const res = await fetch(`/api/scopes/${encodeURIComponent(scope)}`, { method: "PUT" });
      setBusy(false);
      if (res.ok) {
        onReload();
        return { ok: true };
      }
      const data: { error?: string } = await res.json();
      return { ok: false, error: data.error ?? "Could not claim scope" };
    },
    [onReload],
  );

  return { busy, claim };
}
