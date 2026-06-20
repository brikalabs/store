import { ShieldCheck } from "lucide-react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { ShowcaseCard, Stat } from "@/components/plugin/showcase-card";
import { formatCount } from "@/lib/format";
import type { ScopePage } from "@/lib/registry/registry";

/**
 * The public scope page (`/@scope`): every plugin published under a scope, with its
 * verified publisher (the owning org) in the header. The scope is the package
 * namespace and the prefix of every `@scope/name` it owns, so the page reads as the
 * scope's catalogue. Rendered only when the scope has at least one listed plugin
 * (the route 404s otherwise).
 */
export function ScopeView({ page }: Readonly<{ page: ScopePage }>) {
  const { scope, displayName, verified, plugins } = page;
  const name = displayName ?? scope;
  const weekly = plugins.reduce((sum, plugin) => sum + plugin.downloadsWeekly, 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <GradientAvatar seed={scope} label={name} size={84} className="rounded-[20px]" />
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
          <div className="mt-4 flex flex-wrap gap-6">
            <Stat value={String(plugins.length)} label="plugins" />
            <Stat value={formatCount(weekly)} label="installs / week" />
          </div>
        </div>
      </header>

      <div className="h-px bg-border" />

      <section className="flex flex-col gap-4">
        <h2 className="font-bold font-heading text-xl tracking-tight">
          Plugins <span className="font-medium text-muted-foreground">{plugins.length}</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <ShowcaseCard key={plugin.name} plugin={plugin} />
          ))}
        </div>
      </section>
    </main>
  );
}
