import { useCallback, useState } from "react";

/**
 * The scope moderation mutations for the operator console (takedown/restore, plus a bulk takedown):
 * the page stays presentational and owns the list itself (via `useOperatorList`), so the hook takes
 * that page's `reload` and refreshes through it on success. `busy` tracks the single scope mid-action
 * (so only its row disables) and `bulkBusy` the bulk run; a failure surfaces through `error`.
 */
export function useOperatorScopeModeration(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = useCallback(
    async (scope: string, path: string, body?: unknown) => {
      setBusy(scope);
      setError(null);
      const res = await fetch(`/api/operator/scopes/${encodeURIComponent(scope)}/${path}`, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      setBusy(null);
      if (res.ok) {
        reload();
        return;
      }
      const result: { error?: string } = await res.json();
      setError(result.error ?? "Action failed");
    },
    [reload],
  );

  const bulkTakedown = useCallback(
    async (scopes: string[], reason: string) => {
      setBulkBusy(true);
      setError(null);
      const results = await Promise.all(
        scopes.map((scope) =>
          fetch(`/api/operator/scopes/${encodeURIComponent(scope)}/takedown`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reason }),
          }),
        ),
      );
      setBulkBusy(false);
      reload();
      if (!results.every((r) => r.ok)) setError("Some scopes could not be taken down.");
    },
    [reload],
  );

  return { busy, bulkBusy, error, act, bulkTakedown };
}
