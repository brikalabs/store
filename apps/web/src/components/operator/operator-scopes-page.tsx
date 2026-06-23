import { Input } from "@brika/clay";
import { Layers } from "lucide-react";
import { useCallback, useState } from "react";
import { Pager } from "@/components/clay/pagination";
import { OperatorShell } from "@/components/operator/operator-shell";
import { TakedownControls } from "@/components/operator/takedown-controls";
import { useServerPage } from "@/hooks/use-server-page";

interface OperatorScope {
  scope: string;
  displayName: string | null;
  takedown: string | null;
}

const PAGE_SIZE = 20;

export function OperatorScopesPage() {
  const list = useServerPage<OperatorScope>("/api/operator/scopes", PAGE_SIZE);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        list.reload();
        return;
      }
      const result: { error?: string } = await res.json();
      setError(result.error ?? "Action failed");
    },
    [list.reload],
  );

  function renderBody() {
    if (list.loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (list.items.length === 0) {
      return <p className="text-muted-foreground text-sm">No scopes match.</p>;
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {list.items.map((scope) => (
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
        value={list.query}
        onChange={(e) => list.setQuery(e.target.value)}
        placeholder="Filter by scope or name"
        className="max-w-sm"
      />

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      {renderBody()}

      <Pager
        page={list.page}
        pages={list.pages}
        from={list.from}
        to={list.to}
        total={list.total}
        noun="scopes"
        onChange={list.setPage}
      />
    </OperatorShell>
  );
}
