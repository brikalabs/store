import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OperatorShell } from "@/components/operator/operator-shell";

export const Route = createFileRoute("/operator/audit")({
  component: OperatorAuditPage,
});

interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  version: string | null;
  actor: string | null;
  detail: Record<string, unknown> | null;
  at: string;
}

/** A takedown/removal action reads as destructive; everything else is neutral. */
function isDestructive(action: string): boolean {
  return action.includes("takedown") || action.includes("remove") || action === "yank";
}

function OperatorAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/operator/audit?limit=100");
      if (!res.ok) return;
      const data: { entries: AuditEntry[] } = await res.json();
      setEntries(data.entries);
    })();
  }, []);

  function renderBody() {
    if (entries === null) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (entries.length === 0) {
      return <p className="text-muted-foreground text-sm">No audit entries yet.</p>;
    }
    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground text-xs">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground text-xs">
                  {new Date(e.at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium text-xs ${
                      isDestructive(e.action)
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {e.action}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {e.target ?? "·"}
                  {e.version !== null && (
                    <span className="text-muted-foreground">@{e.version}</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{e.actor ?? "·"}</td>
                <td className="max-w-xs truncate px-4 py-2 text-muted-foreground text-xs">
                  {e.detail === null ? "·" : JSON.stringify(e.detail)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <OperatorShell activeLabel="Audit log">
      <header className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Audit log</h1>
        <p className="text-muted-foreground text-sm">
          The 100 most recent registry actions (publishes, takedowns, member and domain changes),
          newest first.
        </p>
      </header>

      {renderBody()}
    </OperatorShell>
  );
}
