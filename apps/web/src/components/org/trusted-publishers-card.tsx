import { Button, Input } from "@brika/clay";
import { KeyRound, Plus, X } from "lucide-react";
import { type SyntheticEvent, useCallback, useEffect, useState } from "react";
import { type OrgCardProps, orgPath, readError } from "@/lib/org-api";

interface Binding {
  repository: string;
  workflow: string;
}

function publishersPath(org: string, scope: string): string {
  return orgPath(org, `/scopes/${encodeURIComponent(scope)}/trusted-publishers`);
}

/**
 * Trusted-publisher bindings for one scope (PUB-016): the GitHub repo + workflow allowed to
 * publish under it via tokenless OIDC. Lists the bindings and, for an admin, adds/removes
 * them. Each owned scope renders one of these.
 */
function ScopePublishers({
  org,
  scope,
  isAdmin,
  onError,
}: Readonly<OrgCardProps & { scope: string; isAdmin: boolean }>) {
  const [bindings, setBindings] = useState<Binding[] | null>(null);
  const [repository, setRepository] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(publishersPath(org, scope));
    if (res.ok) {
      const data: { publishers: Binding[] } = await res.json();
      setBindings(data.publishers);
    }
  }, [org, scope]);
  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(method: "PUT" | "DELETE", body: Binding) {
    setBusy(true);
    const res = await fetch(publishersPath(org, scope), {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      await load();
      return true;
    }
    onError(await readError(res));
    return false;
  }

  async function add(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await mutate("PUT", { repository: repository.trim(), workflow: workflow.trim() })) {
      setRepository("");
      setWorkflow("");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <span className="font-mono font-semibold text-foreground text-sm">{scope}</span>
      {bindings === null ? (
        <div className="h-8 animate-pulse rounded-lg bg-muted" />
      ) : bindings.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No trusted publishers. CI publishes to this scope are refused until you add one.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {bindings.map((b) => (
            <li key={`${b.repository} ${b.workflow}`} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-foreground">{b.repository}</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-mono text-muted-foreground">{b.workflow}</span>
              {isAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => mutate("DELETE", b)}
                  aria-label={`Remove ${b.repository} ${b.workflow}`}
                  className="ml-auto rounded-md p-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && (
        <form
          onSubmit={add}
          className="flex flex-col gap-2 border-border border-t pt-3 sm:flex-row"
        >
          <Input
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            placeholder="owner/repo"
            aria-label="GitHub repository"
            className="font-mono"
          />
          <Input
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            placeholder="publish.yml"
            aria-label="Workflow filename"
            className="font-mono sm:max-w-[12rem]"
          />
          <Button
            type="submit"
            disabled={busy || repository.trim().length === 0 || workflow.trim().length === 0}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * Trusted publishers (PUB-016): the GitHub repos + workflows authorized to publish to the
 * org's scopes via tokenless OIDC, the secure path for CI publishing to Brika. One block per
 * owned scope. Reads the org's scopes, so it shows once at least one scope is attached.
 */
export function TrustedPublishersCard({
  org,
  isAdmin,
  onError,
}: Readonly<OrgCardProps & { isAdmin: boolean }>) {
  const [scopes, setScopes] = useState<string[] | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(orgPath(org, "/scopes"));
      if (res.ok) {
        const data: { scopes: string[] } = await res.json();
        setScopes(data.scopes);
      }
    })();
  }, [org]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-brand-ink" />
        <h2 className="font-bold font-heading text-lg tracking-tight">Trusted publishers</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        Authorize a GitHub repo + workflow to publish to a scope from CI with no token (OIDC). A
        release running that workflow publishes to Brika; a publish from anywhere else is refused.
      </p>
      {scopes === null ? (
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
      ) : scopes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Attach a scope first, then authorize a repo.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {scopes.map((scope) => (
            <ScopePublishers
              key={scope}
              org={org}
              scope={scope}
              isAdmin={isAdmin}
              onError={onError}
            />
          ))}
        </div>
      )}
    </section>
  );
}
