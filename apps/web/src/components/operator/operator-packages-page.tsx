import { Input } from "@brika/clay";
import { Box as BoxIcon, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { OperatorShell } from "@/components/operator/operator-shell";
import { TakedownControls } from "@/components/operator/takedown-controls";

interface OperatorPackage {
  name: string;
  scope: string | null;
  scopeDisplayName: string | null;
  latestVersion: string | null;
  versionCount: number;
  takenDownCount: number;
  yankedCount: number;
}

interface PackageVersion {
  version: string;
  publishedAt: string;
  deprecated: string | null;
  yanked: boolean;
  takedownReason: string | null;
}

export function OperatorPackagesPage() {
  const [packages, setPackages] = useState<OperatorPackage[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/operator/packages");
    if (res.ok) {
      const data: { packages: OperatorPackage[] } = await res.json();
      setPackages(data.packages);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (packages ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function renderBody() {
    if (packages === null) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (filtered.length === 0) {
      return <p className="text-muted-foreground text-sm">No packages match.</p>;
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {filtered.map((pkg) => (
          <PackageRow key={pkg.name} pkg={pkg} onError={setError} onChanged={load} />
        ))}
      </ul>
    );
  }

  return (
    <OperatorShell activeLabel="Packages">
      <header className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Packages</h1>
        <p className="text-muted-foreground text-sm">
          Every published package, including those hidden from the public catalog. Expand one to
          take down or restore individual versions; the reason is recorded in the audit log.
        </p>
      </header>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by package name"
        className="max-w-sm"
      />

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      {renderBody()}
    </OperatorShell>
  );
}

function PackageRow({
  pkg,
  onError,
  onChanged,
}: Readonly<{
  pkg: OperatorPackage;
  onError: (message: string | null) => void;
  onChanged: () => Promise<void>;
}>) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<PackageVersion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/operator/packages/versions?name=${encodeURIComponent(pkg.name)}`);
    if (res.ok) {
      const data: { versions: PackageVersion[] } = await res.json();
      setVersions(data.versions);
    }
  }, [pkg.name]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && versions === null) void loadVersions();
  }

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
        await Promise.all([loadVersions(), onChanged()]);
        return;
      }
      const data: { error?: string } = await res.json();
      onError(data.error ?? "Action failed");
    },
    [pkg.name, loadVersions, onChanged, onError],
  );

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/50"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <BoxIcon className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium font-mono text-sm">{pkg.name}</div>
          <div className="truncate text-muted-foreground text-xs">
            {pkg.scopeDisplayName ?? pkg.scope ?? "unclaimed"} · {pkg.versionCount} version
            {pkg.versionCount === 1 ? "" : "s"}
          </div>
        </div>
        {pkg.takenDownCount > 0 && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
            {pkg.takenDownCount} taken down
          </span>
        )}
        {pkg.yankedCount > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
            {pkg.yankedCount} yanked
          </span>
        )}
      </button>

      {open && (
        <div className="border-border border-t bg-muted/20 px-4 py-2">
          {versions === null ? (
            <p className="py-2 text-muted-foreground text-sm">Loading versions…</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {versions.map((v) => (
                <li key={v.version} className="flex items-center gap-4 py-2">
                  <span className="font-mono text-sm">{v.version}</span>
                  {v.takedownReason !== null && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive text-xs">
                      taken down: {v.takedownReason}
                    </span>
                  )}
                  {v.yanked && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                      yanked
                    </span>
                  )}
                  <div className="flex-1" />
                  <TakedownControls
                    takenDown={v.takedownReason !== null}
                    busy={busy === v.version}
                    onTakedown={(reason) => act(v.version, "takedown", reason)}
                    onRestore={() => act(v.version, "restore")}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
