import { Button, Input } from "@brika/clay";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Check, Cloud, Layers, Rocket, ShieldCheck } from "lucide-react";
import { type ComponentType, useState } from "react";
import { GithubIcon, GitlabIcon } from "@/components/clay/icons";
import { Pill } from "@/components/clay/pill";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { ErrorBanner } from "@/components/layout/error-banner";
import { useCreatePlugin } from "@/hooks/use-create-plugin";
import { MAX_NAME, type NameCheck, useNameCheck } from "@/hooks/use-name-check";
import { type MemberScope, useScopes } from "@/hooks/use-scopes";
import { type AppKey, useT } from "@/i18n";

const route = getRouteApi("/dashboard/plugins/create");

const CHECK_PILL: Record<
  Exclude<NameCheck, "idle">,
  { tone: "muted" | "success" | "danger"; textKey: AppKey }
> = {
  checking: { tone: "muted", textKey: "plugin:checkChecking" },
  ok: { tone: "success", textKey: "plugin:checkAvailable" },
  taken: { tone: "danger", textKey: "plugin:checkTaken" },
  invalid: { tone: "danger", textKey: "plugin:checkInvalid" },
};

const PROVIDERS = [
  { value: "github", label: "GitHub", icon: GithubIcon },
  { value: "gitlab", label: "GitLab", icon: GitlabIcon },
  { value: "azure", label: "Azure", icon: Cloud },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}>;
type Provider = (typeof PROVIDERS)[number]["value"];

/**
 * Reserve a plugin name in one of your scopes (and optionally wire a trusted publisher). The name
 * is held as "Reserved" and hidden from the store until the first publish from CI or the CLI.
 */
export function CreatePluginPage() {
  const t = useT();
  const { user } = route.useRouteContext();
  const navigate = useNavigate();
  const { scopes } = useScopes();
  const adminScopes = scopes?.filter((s) => s.role === "admin") ?? [];
  const { busy, error, create: reserve } = useCreatePlugin();

  const [scope, setScope] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("github");
  const [repo, setRepo] = useState("");
  const [workflow, setWorkflow] = useState("");

  // Default the selected scope to the first one once they load.
  const selected = scope ?? adminScopes[0]?.scope ?? null;
  const fullPkg = `${selected ?? "@scope"}/${name || "my-plugin"}`;
  const check = useNameCheck(selected, name);
  const canCreate = selected !== null && check === "ok" && !busy;

  async function create() {
    if (selected === null || check !== "ok") return;
    const publisher =
      (provider === "github" || provider === "gitlab") && repo.trim() && workflow.trim()
        ? { provider, repository: repo.trim(), workflow: workflow.trim() }
        : undefined;
    if (await reserve(selected, name, publisher)) navigate({ to: "/dashboard/plugins" });
  }

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="My plugins">
      <div className="flex flex-col gap-[22px]">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-muted-foreground">
            <Link to="/dashboard/plugins" className="transition-colors hover:text-brand-ink">
              {t("plugin:myPlugins")}
            </Link>
            <span>/</span>
            <span className="text-foreground">{t("plugin:createBreadcrumb")}</span>
          </div>
          <h1 className="mt-2 font-bold font-heading text-[30px] text-foreground tracking-tight">
            {t("plugin:createTitle")}
          </h1>
          <p className="mt-1.5 max-w-[640px] text-[15px] text-muted-foreground">
            {t("plugin:createIntroBefore")}{" "}
            <strong className="font-semibold text-foreground">
              {t("plugin:createIntroReserved")}
            </strong>{" "}
            {t("plugin:createIntroAfter")}
          </p>
        </div>

        {scopes !== null && adminScopes.length === 0 ? (
          <NoScopeGate onClaim={() => navigate({ to: "/dashboard/scopes" })} />
        ) : (
          <div className="flex flex-col gap-[18px]">
            {error !== null && <ErrorBanner>{error}</ErrorBanner>}

            <ScopeStep scopes={adminScopes} selected={selected} onSelect={setScope} />

            <NameStep
              name={name}
              selected={selected}
              check={check}
              fullPkg={fullPkg}
              onChange={setName}
            />

            <PublisherStep
              provider={provider}
              repo={repo}
              workflow={workflow}
              onProvider={setProvider}
              onRepo={setRepo}
              onWorkflow={setWorkflow}
            />

            <CreateFooter
              fullPkg={fullPkg}
              busy={busy}
              canCreate={canCreate}
              onCancel={() => navigate({ to: "/dashboard/plugins" })}
              onCreate={create}
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}

/** Step 1: pick which administered scope owns the plugin. */
function ScopeStep({
  scopes,
  selected,
  onSelect,
}: Readonly<{
  scopes: MemberScope[];
  selected: string | null;
  onSelect: (scope: string) => void;
}>) {
  const t = useT();
  return (
    <SettingsCard className="gap-0 rounded-[20px]">
      <Step n={1} title={t("plugin:stepScopeTitle")} hint={t("plugin:stepScopeHint")}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {scopes.map((s) => {
            const active = s.scope === selected;
            return (
              <button
                key={s.scope}
                type="button"
                onClick={() => onSelect(s.scope)}
                className={`flex items-center gap-3 rounded-[14px] border-[1.5px] p-3.5 text-left transition-colors ${
                  active
                    ? "border-brand-border bg-brand-tint"
                    : "border-border bg-card hover:border-brand-border"
                }`}
              >
                <GradientAvatar
                  seed={s.scope}
                  label={s.scope}
                  imageUrl={`/api/scopes/${encodeURIComponent(s.scope)}/icon`}
                  size={34}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono font-bold text-[13.5px] text-foreground">
                    {s.scope}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {s.displayName ?? t("plugin:scopeFallback")}
                  </span>
                </span>
                {active ? <Check className="size-[18px] shrink-0 text-brand-ink" /> : null}
              </button>
            );
          })}
        </div>
      </Step>
    </SettingsCard>
  );
}

/** Step 2: the plugin name input with the scope prefix and the live-check pill. */
function NameStep({
  name,
  selected,
  check,
  fullPkg,
  onChange,
}: Readonly<{
  name: string;
  selected: string | null;
  check: NameCheck;
  fullPkg: string;
  onChange: (name: string) => void;
}>) {
  const t = useT();
  return (
    <SettingsCard className="gap-0 rounded-[20px]">
      <Step n={2} title={t("plugin:stepNameTitle")} hint={t("plugin:stepNameHint")}>
        <div className="flex h-12 max-w-[520px] items-stretch overflow-hidden rounded-[13px] border border-input bg-muted focus-within:border-brand-border focus-within:bg-card focus-within:ring-2 focus-within:ring-brand-tint">
          <span className="flex items-center border-border border-r bg-accent px-3.5 font-mono font-semibold text-[14px] text-muted-foreground">
            {selected ?? "@scope"}/
          </span>
          <input
            value={name}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            placeholder="my-plugin"
            aria-label={t("plugin:stepNameTitle")}
            maxLength={selected ? MAX_NAME - selected.length - 1 : MAX_NAME}
            className="min-w-0 flex-1 bg-transparent px-3.5 font-mono text-[14px] text-foreground outline-none"
          />
          {check !== "idle" && (
            <span className="flex items-center pr-2.5">
              <Pill tone={CHECK_PILL[check].tone} size="sm">
                {t(CHECK_PILL[check].textKey)}
              </Pill>
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <span>{t("plugin:fullId")}</span>
          <span className="rounded-lg border border-border bg-muted px-2.5 py-1 font-mono text-[13px] text-foreground">
            {fullPkg}
          </span>
        </div>
      </Step>
    </SettingsCard>
  );
}

/** Step 3 (optional): pick a trusted-publisher provider and fill its repo + workflow. */
function PublisherStep({
  provider,
  repo,
  workflow,
  onProvider,
  onRepo,
  onWorkflow,
}: Readonly<{
  provider: Provider;
  repo: string;
  workflow: string;
  onProvider: (provider: Provider) => void;
  onRepo: (repo: string) => void;
  onWorkflow: (workflow: string) => void;
}>) {
  const t = useT();
  return (
    <SettingsCard className="gap-0 rounded-[20px]">
      <Step
        n={3}
        title={t("plugin:stepPublisherTitle")}
        optional
        hint={t("plugin:stepPublisherHint")}
      >
        <div
          role="tablist"
          aria-label={t("plugin:stepPublisherTitle")}
          className="mb-3 flex max-w-[420px] gap-1 rounded-xl border border-border bg-muted p-1"
        >
          {PROVIDERS.map(({ value, label, icon: Icon }) => {
            const active = value === provider;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onProvider(value)}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold text-[13px] transition-colors ${
                  active
                    ? "bg-card text-brand-ink shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            );
          })}
        </div>
        {provider === "azure" ? (
          <p className="text-[13px] text-muted-foreground">{t("plugin:azureComingSoon")}</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <Input
              value={repo}
              onChange={(e) => onRepo(e.target.value)}
              placeholder="owner/repository"
              aria-label={t("plugin:repositoryLabel")}
              className="h-[42px] min-w-[180px] flex-1 rounded-[11px] border-input bg-muted font-mono text-[13px]"
            />
            <Input
              value={workflow}
              onChange={(e) => onWorkflow(e.target.value)}
              placeholder="publish.yml"
              aria-label={t("plugin:workflowLabel")}
              className="h-[42px] w-[160px] rounded-[11px] border-input bg-muted font-mono text-[13px]"
            />
          </div>
        )}
      </Step>
    </SettingsCard>
  );
}

/** The reserve summary plus Cancel / Create actions. */
function CreateFooter({
  fullPkg,
  busy,
  canCreate,
  onCancel,
  onCreate,
}: Readonly<{
  fullPkg: string;
  busy: boolean;
  canCreate: boolean;
  onCancel: () => void;
  onCreate: () => void;
}>) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[18px] border border-border bg-muted px-[22px] py-[18px]">
      <ShieldCheck className="size-[18px] shrink-0 text-muted-foreground" />
      <p className="min-w-[200px] flex-1 text-[12.5px] text-muted-foreground leading-relaxed">
        {t("plugin:reserveSummaryBefore")}{" "}
        <span className="font-mono text-foreground">{fullPkg}</span>{" "}
        {t("plugin:reserveSummaryMiddle")}{" "}
        <strong className="font-semibold text-foreground">{t("plugin:statusReserved")}</strong>{" "}
        {t("plugin:reserveSummaryAfter")}
      </p>
      <Button type="button" variant="outline" onClick={onCancel}>
        {t("plugin:cancel")}
      </Button>
      <Button type="button" disabled={!canCreate} onClick={onCreate}>
        <Rocket className="size-4" />
        {busy ? t("plugin:creating") : t("plugin:createCta")}
      </Button>
    </div>
  );
}

/** A numbered step header (circle + title) over its body. */
function Step({
  n,
  title,
  hint,
  optional = false,
  children,
}: Readonly<{
  n: number;
  title: string;
  hint: string;
  optional?: boolean;
  children: React.ReactNode;
}>) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-[22px] items-center justify-center rounded-full font-bold text-[12px] ${
              optional ? "bg-accent text-muted-foreground" : "bg-brand-tint text-brand-ink"
            }`}
          >
            {n}
          </span>
          <h2 className="font-bold font-heading text-[17px] text-foreground">{title}</h2>
          {optional ? (
            <Pill tone="muted" size="sm" className="font-bold">
              {t("plugin:optional")}
            </Pill>
          ) : null}
        </div>
        <p className="mt-1 ml-8 text-[13px] text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** Shown when the user administers no scope: a plugin must live under one. */
function NoScopeGate({ onClaim }: Readonly<{ onClaim: () => void }>) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[18px] border border-warning-border bg-warning-tint px-[22px] py-5">
      <Layers className="size-5 shrink-0 text-warning" />
      <div className="min-w-[200px] flex-1">
        <div className="font-bold text-[14px] text-foreground">{t("plugin:noScopeTitle")}</div>
        <div className="text-[13px] text-muted-foreground">{t("plugin:noScopeDescription")}</div>
      </div>
      <Button type="button" onClick={onClaim}>
        {t("plugin:claimScope")}
      </Button>
    </div>
  );
}
