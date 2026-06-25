import { InputGroup, InputGroupAddon, InputGroupInput } from "@brika/clay/components/input-group";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Pill } from "@/components/clay/pill";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { VerifiedBadge } from "@/components/plugin/verified-badge";
import { useClaimScope } from "@/hooks/use-claim-scope";
import { type MemberScope, useScopes } from "@/hooks/use-scopes";
import { useT } from "@/i18n";

const route = getRouteApi("/dashboard/scopes");

export function ScopesPage() {
  const t = useT();
  const { user } = route.useRouteContext();
  const { scopes, reload } = useScopes();
  const { busy, claim } = useClaimScope(reload);
  // The leading `@` is a fixed InputGroup addon, so the field holds only the bare name.
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onClaim(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await claim(`@${name.trim()}`);
    if (result.ok) setName("");
    else setError(result.error);
  }

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="Scopes">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          {t("scope:pageHeading")}
        </h1>
        <p className="max-w-[620px] text-muted-foreground text-sm">
          {t("scope:introPrefix")}
          <span className="font-mono text-foreground">@acme</span>
          {t("scope:introSuffix")}
        </p>
      </header>

      <SettingsCard className="block rounded-[20px]">
        <form onSubmit={onClaim} className="contents">
          <h2 className="mb-3.5 font-bold font-heading text-foreground text-lg tracking-tight">
            {t("scope:claimHeading")}
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <InputGroup className="h-[46px] flex-1">
              <InputGroupAddon align="inline-start" className="font-mono text-muted-foreground">
                @
              </InputGroupAddon>
              <InputGroupInput
                value={name}
                onChange={(event) => setName(event.target.value.toLowerCase().replace(/@/g, ""))}
                placeholder={t("scope:claimPlaceholder")}
                aria-label={t("scope:claimAriaLabel")}
                className="font-mono"
              />
            </InputGroup>
            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              className="inline-flex h-[46px] items-center gap-2 rounded-xl bg-brand px-5 font-bold text-brand-foreground text-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" />
              {busy ? t("scope:claiming") : t("scope:claim")}
            </button>
          </div>
          {error !== null && <p className="mt-3 text-danger text-sm">{error}</p>}
        </form>
      </SettingsCard>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-heading text-foreground text-lg tracking-tight">
          {t("scope:yourScopes")}
        </h2>
        <ScopeList scopes={scopes} />
      </section>
    </AdminShell>
  );
}

function ScopeList({ scopes }: Readonly<{ scopes: MemberScope[] | null }>) {
  const t = useT();
  if (scopes === null) {
    return <div className="h-20 animate-pulse rounded-[18px] bg-muted" />;
  }
  if (scopes.length === 0) {
    return (
      <p className="rounded-[18px] border border-border border-dashed bg-card/50 p-6 text-center text-muted-foreground text-sm">
        {t("scope:noScopes")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {scopes.map((s) => (
        <li key={s.scope}>
          <Link
            to="/dashboard/scopes/$scope"
            params={{ scope: s.scope }}
            className="flex items-center gap-[15px] rounded-[18px] border border-border bg-card p-[18px] shadow-sm transition-all hover:border-brand-border hover:shadow-md"
          >
            <GradientAvatar
              seed={s.scope}
              label={s.scope}
              imageUrl={`/api/scopes/${encodeURIComponent(s.scope)}/icon`}
              size={44}
              className="rounded-[13px]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-mono font-semibold text-base text-foreground">
                {s.scope}
                {s.verified ? <VerifiedBadge className="size-4" /> : null}
              </div>
              {s.displayName != null && (
                <div className="mt-0.5 text-muted-foreground text-xs">{s.displayName}</div>
              )}
            </div>
            <Pill tone="muted" className="px-3 font-bold capitalize">
              {s.role}
            </Pill>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
