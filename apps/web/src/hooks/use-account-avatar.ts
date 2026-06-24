import { useCallback, useState } from "react";

/**
 * Upload or clear the signed-in account's avatar, so the picker stays presentational. `upload` takes a
 * cropped WebP blob (encoded in the browser); `remove` clears it and the resolved URL falls back to the
 * provider avatar. Both report the resolved URL through `onChange` and surface a failure as `error`;
 * `clearError` resets it when the user picks a fresh file. `busy` is true while a request is in flight.
 */
export function useAccountAvatar(onChange: (avatarUrl: string | undefined) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const upload = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/account/avatar", {
          method: "POST",
          headers: { "content-type": "image/webp" },
          body: blob,
        });
        if (!res.ok) {
          setError("Upload failed. Try a different image.");
          return;
        }
        const data: { avatarUrl?: string } = await res.json();
        onChange(data.avatarUrl);
      } catch {
        setError("That image could not be processed.");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      const data: { avatarUrl?: string } = await res.json();
      onChange(data.avatarUrl);
    } else {
      setError("Could not remove the avatar.");
    }
  }, [onChange]);

  return { busy, error, clearError, upload, remove };
}
