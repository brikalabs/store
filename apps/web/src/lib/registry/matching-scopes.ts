import type { PluginSummary } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";

export type ScopeHit = {
  scope: string;
  name: string;
  count: number;
  weekly: number;
};

/** The scopes whose name (or publisher) matches the query, top 3 by plugin count. */
export function matchingScopes(plugins: PluginSummary[], query: string): ScopeHit[] {
  const needle = query.trim().toLowerCase();
  const byScope = new Map<string, ScopeHit>();
  for (const plugin of plugins) {
    const scope = scopeOf(plugin.name);
    if (scope === null) continue;
    const existing = byScope.get(scope) ?? {
      scope,
      name: plugin.author?.name ?? scope,
      count: 0,
      weekly: 0,
    };
    existing.count += 1;
    existing.weekly += plugin.downloadsWeekly;
    byScope.set(scope, existing);
  }
  return [...byScope.values()]
    .filter(
      (hit) => hit.scope.toLowerCase().includes(needle) || hit.name.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}
