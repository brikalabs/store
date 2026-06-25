import type { PluginSummary } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";

/** One owning scope, aggregated over a list of its plugins: the publisher name + verified flag, the
 *  plugin count, and the combined weekly installs. */
export interface ScopeAggregate {
  scope: string;
  name: string;
  count: number;
  weekly: number;
  verified: boolean;
}

/** Group plugins by owning scope, accumulating the per-scope counts/installs and publisher identity. */
export function groupByScope(plugins: PluginSummary[]): ScopeAggregate[] {
  const byScope = new Map<string, ScopeAggregate>();
  for (const plugin of plugins) {
    const scope = scopeOf(plugin.name);
    if (scope === null) continue;
    const existing = byScope.get(scope) ?? {
      scope,
      name: plugin.author?.name ?? scope,
      count: 0,
      weekly: 0,
      verified: plugin.author?.verified ?? false,
    };
    existing.count += 1;
    existing.weekly += plugin.downloadsWeekly;
    byScope.set(scope, existing);
  }
  return [...byScope.values()];
}

/** The most-popular scopes, by plugin count (e.g. for a discovery rail). */
export function topScopes(plugins: PluginSummary[], limit: number): ScopeAggregate[] {
  return groupByScope(plugins)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** The scopes whose name (or publisher) matches the query, top 3 by plugin count. */
export function matchingScopes(plugins: PluginSummary[], query: string): ScopeAggregate[] {
  const needle = query.trim().toLowerCase();
  return groupByScope(plugins)
    .filter(
      (hit) => hit.scope.toLowerCase().includes(needle) || hit.name.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}
