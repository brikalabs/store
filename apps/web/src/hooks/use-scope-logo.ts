import { useCallback, useState } from "react";
import { readError, scopePath } from "@/lib/scope-api";

/**
 * The logo data for a scope: upload a cropped WebP blob or clear it, so the card stays presentational.
 * `iconUrl` carries a cache-buster that changes on success to reload the image; a failure reports
 * through `onError`. The blob is encoded WebP in the browser before it reaches `upload`.
 */
export function useScopeLogo(scope: string, onError: (message: string) => void) {
  const [bust, setBust] = useState(0);
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      try {
        const res = await fetch(scopePath(scope, "/icon"), {
          method: "POST",
          headers: { "content-type": "image/webp" },
          body: blob,
        });
        if (res.ok) setBust((n) => n + 1);
        else onError(await readError(res));
      } catch {
        onError("That image could not be processed. Try a PNG, JPEG, or WebP.");
      } finally {
        setBusy(false);
      }
    },
    [scope, onError],
  );

  const clear = useCallback(async () => {
    setBusy(true);
    const res = await fetch(scopePath(scope, "/icon"), { method: "DELETE" });
    setBusy(false);
    if (res.ok) setBust((n) => n + 1);
    else onError(await readError(res));
  }, [scope, onError]);

  return {
    // Cache-buster reloads the image after upload/clear; a 404 (no logo) shows the gradient avatar.
    iconUrl: `${scopePath(scope, "/icon")}?v=${bust}`,
    busy,
    upload,
    clear,
  };
}
