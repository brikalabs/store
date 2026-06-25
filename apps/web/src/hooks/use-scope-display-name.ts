import { useCallback, useState } from "react";
import { readError, scopePath } from "@/lib/scope-api";

/**
 * The display-name mutation for a scope: POST the trimmed name (or null to clear) and report a
 * failure through `onError`, so the card stays presentational. `save` resolves to whether the call
 * succeeded (the card flips to its "Saved" state on success).
 */
export function useScopeDisplayName(scope: string, onError: (message: string) => void) {
  const [busy, setBusy] = useState(false);

  const save = useCallback(
    async (displayName: string): Promise<boolean> => {
      setBusy(true);
      const trimmed = displayName.trim();
      const res = await fetch(scopePath(scope, "/display-name"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: trimmed.length === 0 ? null : trimmed }),
      });
      setBusy(false);
      if (res.ok) {
        return true;
      }
      onError(await readError(res));
      return false;
    },
    [scope, onError],
  );

  return { busy, save };
}
