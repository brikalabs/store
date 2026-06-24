import { useCallback, useState } from "react";

/** A trusted-publisher binding sent with the reserve (CI repo + workflow for tokenless publishing). */
export interface CreatePublisher {
  provider: "github" | "gitlab";
  repository: string;
  workflow: string;
}

/**
 * The reserve-a-plugin mutation (`POST /api/plugins/create`): owns the request, the in-flight `busy`
 * flag, and the error message, so the page stays presentational. `create` resolves to whether the
 * reserve succeeded (the page navigates away on success); a 409 maps to the "already taken" message,
 * anything else to the server's `{ error }` or a generic fallback. `clearError` resets before a retry.
 */
export function useCreatePlugin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (
      scope: string,
      name: string,
      publisher: CreatePublisher | undefined,
    ): Promise<boolean> => {
      setBusy(true);
      setError(null);
      const res = await fetch("/api/plugins/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, name, publisher }),
      });
      if (res.ok) return true;
      setBusy(false);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        res.status === 409
          ? "That name is already taken in this scope."
          : (data.error ?? "Could not create the plugin."),
      );
      return false;
    },
    [],
  );

  return { busy, error, create, clearError: () => setError(null) };
}
