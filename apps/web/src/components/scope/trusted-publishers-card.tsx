import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@brika/clay";
import { KeyRound, Plus, X } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Pill } from "@/components/clay/pill";
import { SettingsCard } from "@/components/clay/settings-card";
import { type TrustedPublisher, useTrustedPublishers } from "@/hooks/use-trusted-publishers";
import type { ScopeCardProps } from "@/lib/scope-api";

const PROVIDERS = [
  { value: "github", label: "GitHub", repoHint: "owner/repo", workflowHint: "publish.yml" },
  { value: "gitlab", label: "GitLab", repoHint: "group/project", workflowHint: ".gitlab-ci.yml" },
] as const;

/** One trusted-publisher binding: provider pill, repo + workflow, and an admin-only remove. */
function PublisherListItem({
  binding,
  isAdmin,
  busy,
  onRemove,
}: Readonly<{
  binding: TrustedPublisher;
  isAdmin: boolean;
  busy: boolean;
  onRemove: () => void;
}>) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Pill tone="muted" className="rounded-md bg-muted px-2 py-0.5 capitalize">
        {binding.provider}
      </Pill>
      <span className="font-mono text-foreground">{binding.repository}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-mono text-muted-foreground">{binding.workflow}</span>
      {isAdmin && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Remove ${binding.provider} ${binding.repository} ${binding.workflow}`}
          className="ml-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-danger"
        >
          <X className="size-4" />
        </Button>
      )}
    </li>
  );
}

/**
 * Trusted publishers (PUB-016): the repos + workflows authorized to publish to this scope via
 * tokenless OIDC. Lists the bindings and, for an admin, adds/removes them.
 */
export function TrustedPublishersCard({
  scope,
  isAdmin,
  onError,
}: Readonly<ScopeCardProps & { isAdmin: boolean }>) {
  const { bindings, busy, add, remove } = useTrustedPublishers(scope, onError);
  const [provider, setProvider] = useState("github");
  const [repository, setRepository] = useState("");
  const [workflow, setWorkflow] = useState("");
  const hints = PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0];

  async function onAdd(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await add({ provider, repository: repository.trim(), workflow: workflow.trim() })) {
      setRepository("");
      setWorkflow("");
    }
  }

  function renderBindings() {
    if (bindings === null) return <div className="h-8 animate-pulse rounded-[10px] bg-muted" />;
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
          <PublisherListItem
            key={`${b.provider} ${b.repository} ${b.workflow}`}
            binding={b}
            isAdmin={isAdmin}
            busy={busy}
            onRemove={() => remove(b)}
          />
        ))}
      </ul>
    );
  }

  return (
    <SettingsCard className="gap-1.5">
      <h2 className="flex items-center gap-2 font-bold text-base text-foreground">
        <KeyRound className="size-[18px] text-brand-ink" />
        Trusted publishers
      </h2>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        Authorize a GitHub repo + workflow to publish to this scope from CI with no token (OIDC). A
        release running that workflow publishes to Brika; a publish from anywhere else is refused.
      </p>
      <div className="mt-2 flex flex-col gap-3 rounded-[13px] border border-border bg-muted p-4">
        <span className="font-mono font-semibold text-foreground text-sm">{scope}</span>
        {renderBindings()}
        {isAdmin && (
          <form
            onSubmit={onAdd}
            className="flex flex-col gap-2.5 border-border border-t pt-3 sm:flex-row"
          >
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger
                aria-label="OIDC provider"
                className="h-[38px] rounded-[10px] border border-input bg-card px-3 font-semibold text-foreground text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder={hints.repoHint}
              aria-label="Repository"
              className="flex-1 rounded-[10px] border-input bg-card font-mono"
            />
            <Input
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
              placeholder={hints.workflowHint}
              aria-label="Workflow filename"
              className="rounded-[10px] border-input bg-card font-mono sm:max-w-[12rem]"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={busy || repository.trim().length === 0 || workflow.trim().length === 0}
              className="h-[38px] rounded-[10px] border border-input bg-card px-3.5 font-semibold text-foreground shadow-none hover:border-brand-border hover:bg-card hover:brightness-100"
            >
              <Plus className="size-4" />
              Add
            </Button>
          </form>
        )}
      </div>
    </SettingsCard>
  );
}
