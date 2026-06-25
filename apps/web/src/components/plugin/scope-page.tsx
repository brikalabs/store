import { Globe } from "lucide-react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { ProfileLinks } from "@/components/plugin/profile-links";
import { PublishedPlugins } from "@/components/plugin/published-plugins";
import { Stat } from "@/components/plugin/showcase-card";
import { VerifiedBadge } from "@/components/plugin/verified-badge";
import { useT } from "@/i18n";
import { formatCount } from "@/lib/format";
import type { ScopePage } from "@/lib/registry/registry";

/**
 * The public scope page (`/@scope`): the scope IS the account, so this is its public profile
 * (display name, links, logo, verified domains) above the grid of every plugin it publishes.
 */
export function ScopeView({ page }: Readonly<{ page: ScopePage }>) {
  const t = useT();
  const { scope, displayName, description, links, hasIcon, verifiedDomains, plugins } = page;
  const verifiedOrg = verifiedDomains.length > 0;
  const name = displayName ?? scope;
  const weekly = plugins.reduce((sum, plugin) => sum + plugin.downloadsWeekly, 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <GradientAvatar
          seed={scope}
          label={name}
          imageUrl={hasIcon ? `/api/scopes/${encodeURIComponent(scope)}/icon` : undefined}
          size={84}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold font-heading text-3xl tracking-tight">{name}</h1>
            {verifiedOrg ? <VerifiedBadge className="size-6" /> : null}
          </div>
          <p className="mt-1 font-mono text-muted-foreground text-sm">{scope}</p>
          {description !== null && description.length > 0 ? (
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">{description}</p>
          ) : null}
          <ProfileLinks links={links} />
          {verifiedDomains.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {verifiedDomains.map((domain) => (
                <span
                  key={domain}
                  title={t("plugin:verifiedDomain")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 font-medium text-sky-600 text-xs dark:text-sky-400"
                >
                  <Globe className="size-3.5" />
                  {domain}
                  <VerifiedBadge className="size-3.5" />
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2.5">
          <Stat value={String(plugins.length)} label={t("plugin:statPlugins")} />
          {weekly > 0 ? (
            <Stat value={formatCount(weekly)} label={t("plugin:statInstallsPerWeek")} />
          ) : null}
        </div>
      </header>

      <div className="h-px bg-border" />

      <PublishedPlugins plugins={plugins} />
    </main>
  );
}
