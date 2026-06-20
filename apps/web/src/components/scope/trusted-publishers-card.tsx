import { Button, Input } from "@brika/clay";
import { KeyRound, Plus, X } from "lucide-react";
import { type SyntheticEvent, useCallback, useEffect, useState } from "react";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

interface Binding {
  provider: string;
  repository: string;
  workflow: string;
}

const PROVIDERS = [
  { value: "github", label: "GitHub", repoHint: "owner/repo", workflowHint: "publish.yml" },
  { value: "gitlab", label: "GitLab", repoHint: "group/project", workflowHint: ".gitlab-ci.yml" },
] as const;

/**
 * Trusted publishers (PUB-016): the GitHub/GitLab repos + workflows authorized to publish to
 * this scope via tokenless OIDC, the secure path for CI publishing to Brika. Lists the
 * bindings and, for an admin, adds/removes them. A scope IS the account, so this binds the
 * scope directly.
 */
export function TrustedPublishersCard({
  scope,
  isAdmin,
  onError,
}: Readonly<ScopeCardProps & { isAdmin: boolean }>) {
  const [bindings, setBindings] = useState<Binding[] | null>(null);
  const [provider, setProvider] = useState("github");
  const [repository, setRepository] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [busy, setBusy] = useState(false);
  const hints = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  const load = useCallback(async () => {
    const res = await fetch(scopePath(scope, "/trusted-publishers"));
    if (res.ok) {
      const data: { publishers: Binding[] } = await res.json();
      setBindings(data.publishers);
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(method: "PUT" | "DELETE", body: Binding) {
    setBusy(true);
    const res = await fetch(scopePath(scope, "/trusted-publishers"), {
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
    if (
      await mutate("PUT", { provider, repository: repository.trim(), workflow: workflow.trim() })
    ) {
      setRepository("");
      setWorkflow("");
    }
  }

  function renderBindings() {
    if (bindings === null) return <div className="h-8 animate-pulse rounded-lg bg-muted" />;
    if (bindings.length === 0) {
      return (
        <p className="text-muted-foreground text-xs">
          No trusted publishers. CI publishes to this scope are refused until you add one.
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-1.5">
        {bindings.map((b) => (
          <li
            key={`${b.provider} ${b.repository} ${b.workflow}`}
            className="flex items-center gap-2 text-sm"
          >
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs capitalize">
              {b.provider}
            </span>
            <span className="font-mono text-foreground">{b.repository}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-muted-foreground">{b.workflow}</span>
            {isAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={() => mutate("DELETE", b)}
                aria-label={`Remove ${b.provider} ${b.repository} ${b.workflow}`}
                className="ml-auto rounded-md p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-brand-ink" />
        <h2 className="font-bold font-heading text-lg tracking-tight">Trusted publishers</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        Authorize a GitHub repo + workflow to publish to this scope from CI with no token (OIDC). A
        release running that workflow publishes to Brika; a publish from anywhere else is refused.
      </p>
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <span className="font-mono font-semibold text-foreground text-sm">{scope}</span>
        {renderBindings()}
        {isAdmin && (
          <form
            onSubmit={add}
            className="flex flex-col gap-2 border-border border-t pt-3 sm:flex-row"
          >
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              aria-label="OIDC provider"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Input
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder={hints.repoHint}
              aria-label="Repository"
              className="font-mono"
            />
            <Input
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
              placeholder={hints.workflowHint}
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
    </section>
  );
}
