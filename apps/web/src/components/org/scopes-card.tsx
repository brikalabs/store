import { Button, Input } from "@brika/clay";
import { Layers, Plus } from "lucide-react";
import { type SyntheticEvent, useCallback, useEffect, useState } from "react";
import { type OrgCardProps, orgPath, readError } from "@/lib/org-api";

/** The owned-scopes list: a loading skeleton, an empty hint, or the scope chips. */
function ScopeList({ scopes }: Readonly<{ scopes: string[] | null }>) {
  if (scopes === null) return <div className="h-12 animate-pulse rounded-xl bg-muted" />;
  if (scopes.length === 0) {
    return <p className="text-muted-foreground text-sm">No scopes attached yet.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {scopes.map((s) => (
        <li
          key={s}
          className="rounded-full border border-border bg-muted px-3 py-1 font-mono font-semibold text-foreground text-sm"
        >
          {s}
        </li>
      ))}
    </ul>
  );
}

/** The npm scopes an org owns (1:N): list, and (admin) attach a new scope. */
export function ScopesCard({
  org,
  isAdmin,
  onError,
}: Readonly<OrgCardProps & { isAdmin: boolean }>) {
  const [scopes, setScopes] = useState<string[] | null>(null);
  const [scope, setScope] = useState("@");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(orgPath(org, "/scopes"));
    if (res.ok) {
      const data: { scopes: string[] } = await res.json();
      setScopes(data.scopes);
    }
  }, [org]);
  useEffect(() => {
    void load();
  }, [load]);

  async function attach(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const res = await fetch(orgPath(org, "/scopes"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: scope.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setScope("@");
      await load();
    } else {
      onError(await readError(res));
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-brand-ink" />
        <h2 className="font-bold font-heading text-lg tracking-tight">Scopes</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        The npm namespaces this organisation owns. A package's{" "}
        <span className="font-mono">@scope</span> must be attached here before any member can
        publish under it.
      </p>
      <ScopeList scopes={scopes} />
      {isAdmin && (
        <form
          onSubmit={attach}
          className="flex flex-col gap-2 border-border border-t pt-4 sm:flex-row"
        >
          <Input
            value={scope}
            onChange={(event) => setScope(event.target.value.toLowerCase())}
            placeholder="@your-scope"
            aria-label="Scope to attach"
            className="font-mono"
          />
          <Button type="submit" disabled={busy || scope.length < 3}>
            <Plus className="size-4" />
            {busy ? "Attaching…" : "Attach scope"}
          </Button>
        </form>
      )}
    </section>
  );
}
