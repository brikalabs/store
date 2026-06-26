import { useCallback, useState } from "react";
import { postJson } from "@/lib/fetch-json";
import { scopePath } from "@/lib/scope-api";

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
      const res = await postJson(scopePath(scope, "/display-name"), {
        displayName: trimmed.length === 0 ? null : trimmed,
      });
      setBusy(false);
      if (res.ok) return true;
      onError(res.error);
      return false;
    },
    [scope, onError],
  );

  return { busy, save };
}
