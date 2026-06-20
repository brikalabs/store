import { Input } from "@brika/clay";
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { OperatorShell } from "@/components/operator/operator-shell";
import { TakedownControls } from "@/components/operator/takedown-controls";

export const Route = createFileRoute("/operator/orgs")({
  component: OperatorOrgsPage,
});

interface OperatorOrg {
  slug: string;
  displayName: string | null;
  takedown: string | null;
}

function OperatorOrgsPage() {
  const [orgs, setOrgs] = useState<OperatorOrg[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/operator/orgs");
    if (res.ok) {
      const data: { orgs: OperatorOrg[] } = await res.json();
      setOrgs(data.orgs);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (slug: string, path: string, body?: unknown) => {
      setBusy(slug);
      setError(null);
      const res = await fetch(`/api/operator/orgs/${encodeURIComponent(slug)}/${path}`, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      setBusy(null);
      if (res.ok) {
        await load();
        return;
      }
      const data: { error?: string } = await res.json();
      setError(data.error ?? "Action failed");
    },
    [load],
  );

  const filtered = (orgs ?? []).filter((o) =>
    `${o.slug} ${o.displayName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function renderBody() {
    if (orgs === null) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (filtered.length === 0) {
      return <p className="text-muted-foreground text-sm">No organisations match.</p>;
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {filtered.map((org) => (
          <li key={org.slug} className="flex items-center gap-4 px-4 py-3">
            <Building2 className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium font-mono text-sm">{org.slug}</span>
                {org.takedown !== null && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
                    Taken down
                  </span>
                )}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {org.takedown === null
                  ? (org.displayName ?? "No display name")
                  : `Reason: ${org.takedown}`}
              </div>
            </div>
            <TakedownControls
              takenDown={org.takedown !== null}
              busy={busy === org.slug}
              onTakedown={(reason) => act(org.slug, "takedown", { reason })}
              onRestore={() => act(org.slug, "restore")}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <OperatorShell activeLabel="Organisations">
      <header className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Organisations</h1>
        <p className="text-muted-foreground text-sm">
          Every organisation on the registry. Taking one down withdraws it from public listings (its{" "}
          <span className="font-mono">/orgs/&lt;slug&gt;</span> page 404s); the reason is recorded
          in the audit log.
        </p>
      </header>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by slug or name"
        className="max-w-sm"
      />

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      {renderBody()}
    </OperatorShell>
  );
}
