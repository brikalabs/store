import { useCallback, useState } from "react";

/** A package row in the operator console: the list item, and what the moderation hook acts on. */
export interface OperatorPackage {
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
}

/** One published version of a package, as the moderation panel lists it. */
export interface PackageVersion {
  version: string;
  publishedAt: string;
  size: number;
  deprecated: string | null;
  yanked: boolean;
  takedownReason: string | null;
}

/**
 * The page-level bulk takedown for the operator packages console: take down every selected package
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
      const res = await fetch("/api/operator/packages/bulk-takedown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names: selectedNames, reason }),
      });
      setBusy(false);
      if (res.ok) {
        onReload();
        return;
      }
      const data: { error?: string } = await res.json();
      setError(data.error ?? "Bulk takedown failed");
    },
    [selectedNames, onReload],
  );

  return { busy, error, setError, bulkTakedown };
}

/**
 * The per-row version moderation for one package: lazily load its versions, take down / restore a
 * single version (`act`), or take down the whole package, reloading versions and notifying the page
 * (`onChanged`) on success. Owns the `versions` cache and the per-version / per-package busy flags so
 * the row stays presentational. `open` gates whether a package-level takedown refreshes the versions.
 */
export function usePackageModeration(
  pkg: OperatorPackage,
  open: boolean,
  onChanged: () => void,
  onError: (message: string | null) => void,
) {
  const [versions, setVersions] = useState<PackageVersion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pkgBusy, setPkgBusy] = useState(false);

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/operator/packages/versions?name=${encodeURIComponent(pkg.name)}`);
    if (res.ok) {
      const data: { versions: PackageVersion[] } = await res.json();
      setVersions(data.versions);
    }
  }, [pkg.name]);

  const act = useCallback(
    async (version: string, path: "takedown" | "restore", reason?: string) => {
      setBusy(version);
      onError(null);
      const res = await fetch(`/api/operator/packages/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          path === "takedown" ? { name: pkg.name, version, reason } : { name: pkg.name, version },
        ),
      });
      setBusy(null);
      if (res.ok) {
        await loadVersions();
        onChanged();
        return;
      }
      const data: { error?: string } = await res.json();
      onError(data.error ?? "Action failed");
    },
    [pkg.name, loadVersions, onChanged, onError],
  );

  const takedownPackage = useCallback(
    async (reason: string) => {
      setPkgBusy(true);
      onError(null);
      const res = await fetch("/api/operator/packages/bulk-takedown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names: [pkg.name], reason }),
      });
      setPkgBusy(false);
      if (res.ok) {
        if (open) await loadVersions();
        onChanged();
        return;
      }
      const data: { error?: string } = await res.json();
      onError(data.error ?? "Take down failed");
    },
    [pkg.name, open, loadVersions, onChanged, onError],
  );

  const setVerified = useCallback(
    async (verified: boolean) => {
      setPkgBusy(true);
      onError(null);
      const res = await fetch("/api/operator/packages/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: pkg.name, verified }),
      });
      setPkgBusy(false);
      if (res.ok) {
        onChanged();
        return;
      }
      const data: { error?: string } = await res.json();
      onError(data.error ?? "Verify failed");
    },
    [pkg.name, onChanged, onError],
  );

  return { versions, busy, pkgBusy, loadVersions, act, takedownPackage, setVerified };
}
