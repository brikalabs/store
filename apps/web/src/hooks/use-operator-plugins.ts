import { useCallback, useState } from "react";
import { postJson } from "@/lib/fetch-json";

/** A plugin row in the operator console: the list item, and what the moderation hook acts on. */
export interface OperatorPlugin {
  name: string;
  scope: string | null;
  scopeDisplayName: string | null;
  latestVersion: string | null;
  versionCount: number;
  takenDownCount: number;
  yankedCount: number;
  updatedAt: string | null;
  installs: number;
  flagReason: string | null;
  openReports: number;
  verified: boolean;
  /** Whole-plugin takedown reason (null = active); set, it withdraws every version incl. future. */
  takedown: string | null;
}

/** One published version of a plugin, as the moderation panel lists it. */
export interface PluginVersion {
  version: string;
  publishedAt: string;
  size: number;
  deprecated: string | null;
  yanked: boolean;
  takedownReason: string | null;
}

/**
 * The page-level bulk takedown for the operator plugins console: take down every selected plugin
 * (each carries its reason into the audit log), then clear the selection and reload on success. Owns
 * the in-flight `busy` flag and the shared `error` the rows also write through `setError`, so the
 * page stays presentational. `selectedNames` and `onReload` come from the page (it owns the list).
 */
export function useBulkTakedown(selectedNames: string[], onReload: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkTakedown = useCallback(
    async (reason: string) => {
      setBusy(true);
      setError(null);
      const res = await postJson("/api/operator/plugins/bulk-takedown", {
        names: selectedNames,
        reason,
      });
      setBusy(false);
      if (res.ok) onReload();
      else setError(res.error);
    },
    [selectedNames, onReload],
  );

  return { busy, error, setError, bulkTakedown };
}

/**
 * The per-row version moderation for one plugin: lazily load its versions, take down / restore a
 * single version (`act`), or take down the whole plugin, reloading versions and notifying the page
 * (`onChanged`) on success. Owns the `versions` cache and the per-version / per-plugin busy flags so
 * the row stays presentational. `open` gates whether a plugin-level takedown refreshes the versions.
 */
export function usePluginModeration(
  pkg: OperatorPlugin,
  open: boolean,
  onChanged: () => void,
  onError: (message: string | null) => void,
) {
  const [versions, setVersions] = useState<PluginVersion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pkgBusy, setPkgBusy] = useState(false);

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/operator/plugins/versions?name=${encodeURIComponent(pkg.name)}`);
    if (res.ok) {
      const data: { versions: PluginVersion[] } = await res.json();
      setVersions(data.versions);
    }
  }, [pkg.name]);

  const act = useCallback(
    async (version: string, path: "takedown" | "restore", reason?: string) => {
      setBusy(version);
      onError(null);
      const res = await postJson(`/api/operator/plugins/${path}`, {
        name: pkg.name,
        version,
        reason,
      });
      setBusy(null);
      if (!res.ok) return onError(res.error);
      await loadVersions();
      onChanged();
    },
    [pkg.name, loadVersions, onChanged, onError],
  );

  // The package-level mutations share a shape: flip the package-busy flag, POST, then on success
  // refresh the open version panel and notify the page; on failure surface the message.
  const pkgAction = useCallback(
    async (url: string, body: unknown) => {
      setPkgBusy(true);
      onError(null);
      const res = await postJson(url, body);
      setPkgBusy(false);
      if (!res.ok) return onError(res.error);
      if (open) await loadVersions();
      onChanged();
    },
    [open, loadVersions, onChanged, onError],
  );

  const takedownPlugin = useCallback(
    (reason: string) =>
      pkgAction("/api/operator/plugins/bulk-takedown", { names: [pkg.name], reason }),
    [pkgAction, pkg.name],
  );
  const restorePlugin = useCallback(
    () => pkgAction("/api/operator/plugins/plugin-restore", { name: pkg.name }),
    [pkgAction, pkg.name],
  );
  const setVerified = useCallback(
    (verified: boolean) => pkgAction("/api/operator/plugins/verify", { name: pkg.name, verified }),
    [pkgAction, pkg.name],
  );

  return { versions, busy, pkgBusy, loadVersions, act, takedownPlugin, restorePlugin, setVerified };
}
