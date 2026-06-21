import { Input } from "@brika/clay";
import { Layers } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { OperatorShell } from "@/components/operator/operator-shell";
import { TakedownControls } from "@/components/operator/takedown-controls";

interface OperatorScope {
  scope: string;
  displayName: string | null;
  takedown: string | null;
}

export function OperatorScopesPage() {
  const [scopes, setScopes] = useState<OperatorScope[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/operator/scopes");
    if (res.ok) {
      const data: { scopes: OperatorScope[] } = await res.json();
      setScopes(data.scopes);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (scope: string, path: string, body?: unknown) => {
      setBusy(scope);
      setError(null);
      const res = await fetch(`/api/operator/scopes/${encodeURIComponent(scope)}/${path}`, {
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

  const filtered = (scopes ?? []).filter((s) =>
    `${s.scope} ${s.displayName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function renderBody() {
    if (scopes === null) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (filtered.length === 0) {
      return <p className="text-muted-foreground text-sm">No scopes match.</p>;
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {filtered.map((scope) => (
          <li key={scope.scope} className="flex items-center gap-4 px-4 py-3">
            <Layers className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium font-mono text-sm">{scope.scope}</span>
                {scope.takedown !== null && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
                    Taken down
                  </span>
                )}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {scope.takedown === null
                  ? (scope.displayName ?? "No display name")
                  : `Reason: ${scope.takedown}`}
              </div>
            </div>
            <TakedownControls
              takenDown={scope.takedown !== null}
              busy={busy === scope.scope}
              onTakedown={(reason) => act(scope.scope, "takedown", { reason })}
              onRestore={() => act(scope.scope, "restore")}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <OperatorShell activeLabel="Scopes">
      <header className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Scopes</h1>
        <p className="text-muted-foreground text-sm">
          Every scope on the registry. Taking one down withdraws it from public listings (its{" "}
          <span className="font-mono">/@scope</span> page 404s); the reason is recorded in the audit
          log.
        </p>
      </header>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by scope or name"
        className="max-w-sm"
      />

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      {renderBody()}
    </OperatorShell>
  );
}
