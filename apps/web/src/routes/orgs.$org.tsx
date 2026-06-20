import { createFileRoute, notFound } from "@tanstack/react-router";
import { Building2, Globe, ShieldCheck } from "lucide-react";
import { LinkIcon } from "@/components/clay/link-icon";
import { PluginCard, Stat } from "@/components/clay/plugin-card";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { formatCount } from "@/lib/format";
import { getOrgPage } from "@/lib/registry/registry";

export const Route = createFileRoute("/orgs/$org")({
  loader: async ({ params }) => {
    const page = await getOrgPage(params.org);
    if (page === null) throw notFound();
    return page;
  },
  component: OrgPage,
});

function OrgPage() {
  const { org, plugins } = Route.useLoaderData();
  const name = org.displayName ?? org.slug;
  const weekly = plugins.reduce((sum, p) => sum + p.downloadsWeekly, 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {org.hasIcon ? (
          <img
            src={`/api/orgs/${encodeURIComponent(org.slug)}/icon`}
            alt={name}
            className="size-[84px] shrink-0 rounded-[20px] border border-border object-cover"
          />
        ) : (
          <GradientAvatar seed={org.slug} label={name} size={84} className="rounded-[20px]" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold font-heading text-3xl tracking-tight">{name}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 font-semibold text-brand-ink text-xs">
              <ShieldCheck className="size-3.5" />
              Verified
            </span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-muted-foreground text-sm">
            <Building2 className="size-3.5" />
            {org.slug}
          </div>
          {org.description !== null && org.description.length > 0 ? (
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
              {org.description}
            </p>
          ) : null}
          {org.links.length > 0 ? (
            <ul className="mt-3.5 flex flex-wrap items-center gap-2">
              {org.links.map((link) => (
                <li key={`${link.label}:${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
                  >
                    <LinkIcon url={link.url} className="size-4 text-muted-foreground" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {org.scopes.map((scope) => (
              <span
                key={scope}
                className="rounded-full border border-border bg-card px-3 py-1 font-mono font-semibold text-foreground text-xs"
              >
                {scope}
              </span>
            ))}
            {org.verifiedDomains.map((domain) => (
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
        </div>
        <div className="flex gap-2.5">
          <Stat value={String(plugins.length)} label="plugins" />
          {weekly > 0 ? <Stat value={formatCount(weekly)} label="weekly" /> : null}
        </div>
      </header>

      <div className="h-px bg-border" />

      <section className="flex flex-col gap-4">
        <h2 className="font-bold font-heading text-xl tracking-tight">
          Plugins <span className="font-medium text-muted-foreground">{plugins.length}</span>
        </h2>
        {plugins.length === 0 ? (
          <p className="text-muted-foreground text-sm">No published Brika plugins yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((plugin) => (
              <PluginCard key={plugin.name} plugin={plugin} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
