import type { PluginSummary } from "@brika/registry-contract";
import { ShowcaseCard } from "@/components/plugin/showcase-card";

/**
 * The "Plugins {n}" section with a responsive card grid (or an empty state),
 * shared by the scope page and the user profile page (`/u/:id`) - both list the
 * plugins an owner publishes.
 */
export function PublishedPlugins({ plugins }: Readonly<{ plugins: PluginSummary[] }>) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-bold font-heading text-xl tracking-tight">
        Plugins <span className="font-medium text-muted-foreground">{plugins.length}</span>
      </h2>
      {plugins.length === 0 ? (
        <p className="text-muted-foreground text-sm">No published Brika plugins yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <ShowcaseCard key={plugin.name} plugin={plugin} />
          ))}
        </div>
      )}
    </section>
  );
}
