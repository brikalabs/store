import { useCallback, useEffect, useState } from "react";

export interface PkgVersion {
  version: string;
  publishedAt: string;
  size: number;
  deprecated: string | null;
  yanked: boolean;
  takedownReason: string | null;
}

export interface VersionsState {
  name: string;
  latest: string | null;
  canManage: boolean;
  versions: PkgVersion[];
}

/**
 * Per-version management for a registry-hosted plugin: load the version list and run the
 * deprecate/yank actions (server-side ownership-gated), so the card stays presentational. The
 * endpoint 404s for packages not published to the registry, surfaced as `notRegistry` (the card
 * then shows a note). Each action reloads on success and reports a failure through `error`; `pending`
 * carries the in-flight action key so a single row's button can disable itself.
 */
export function usePluginVersions(name: string) {
  const [state, setState] = useState<VersionsState | null>(null);
  const [notRegistry, setNotRegistry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/plugins/versions?name=${encodeURIComponent(name)}`);
    if (res.status === 404) {
      setNotRegistry(true);
      return;
    }
    if (res.ok) setState((await res.json()) as VersionsState);
  }, [name]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (path: string, body: unknown, key: string) => {
      setPending(key);
      setError(null);
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setPending(null);
      if (res.ok) {
        await load();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Action failed");
      }
    },
    [load],
  );

  return { state, notRegistry, error, pending, act };
}
