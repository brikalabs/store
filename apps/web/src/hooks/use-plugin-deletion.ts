import { useCallback, useState } from "react";

/**
 * The irreversible delete mutation for a hosted plugin (`POST /api/plugins/delete`), so the danger
 * zone stays presentational. Holds its own `error` (the failure message to show) and resolves
 * `remove` to whether the call succeeded so the caller can navigate away on success.
 */
export function usePluginDeletion(name: string) {
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (): Promise<boolean> => {
    setError(null);
    const res = await fetch("/api/plugins/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return true;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Could not delete this plugin.");
    return false;
  }, [name]);

  return { error, remove };
}
