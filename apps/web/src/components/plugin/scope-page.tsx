import { Globe, ShieldCheck } from "lucide-react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { ProfileLinks } from "@/components/plugin/profile-links";
import { PublishedPlugins } from "@/components/plugin/published-plugins";
import { Stat } from "@/components/plugin/showcase-card";
import { formatCount } from "@/lib/format";
import type { ScopePage } from "@/lib/registry/registry";

/**
 * The public scope page (`/@scope`): the scope IS the account, so this is its rich public
 * profile - its verified display name, description, external links, logo (or a generated
 * avatar), and verified domains - above the grid of every plugin published under it. The
 * scope is the package namespace and the prefix of every `@scope/name` it owns, so the page
 * reads as the scope's catalogue. Rendered when the scope exists or has at least one listed
 * plugin (the route 404s otherwise).
 */
export function ScopeView({ page }: Readonly<{ page: ScopePage }>) {
  const { scope, displayName, verified, description, links, hasIcon, verifiedDomains, plugins } =
    page;
  const name = displayName ?? scope;
  const weekly = plugins.reduce((sum, plugin) => sum + plugin.downloadsWeekly, 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {hasIcon ? (
          <img
            src={`/api/scopes/${encodeURIComponent(scope)}/icon`}
            alt={name}
            className="size-[84px] shrink-0 rounded-[20px] border border-border object-cover"
          />
        ) : (
          <GradientAvatar seed={scope} label={name} size={84} className="rounded-[20px]" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold font-heading text-3xl tracking-tight">{name}</h1>
            {verified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 font-semibold text-brand-ink text-xs">
                <ShieldCheck className="size-3.5" />
                Verified
              </span>
            ) : null}
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
                  title="Verified domain"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 font-medium text-brand-ink text-xs"
                >
                  <Globe className="size-3.5" />
                  {domain}
                  <ShieldCheck className="size-3.5" />
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2.5">
          <Stat value={String(plugins.length)} label="plugins" />
          {weekly > 0 ? <Stat value={formatCount(weekly)} label="installs / week" /> : null}
        </div>
      </header>

      <div className="h-px bg-border" />

      <PublishedPlugins plugins={plugins} />
    </main>
  );
}
