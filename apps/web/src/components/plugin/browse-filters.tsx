import type { SearchCapability } from "@brika/registry-contract";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { CAPABILITY_TILES } from "@/components/plugin/discover-index";

/**
 * The browse filter rail: capability toggle chips plus removable active-tag chips, all driven by the
 * `/plugins` URL search (so a filtered view is shareable and survives reload). Selecting a capability
 * or clearing a tag re-runs the server-side search via the route loader.
 */
export function BrowseFilters({
  capability,
  tags,
}: Readonly<{ capability: SearchCapability | undefined; tags: readonly string[] }>) {
  const navigate = useNavigate();

  const toggleCapability = (key: SearchCapability) =>
    navigate({
      to: "/plugins",
      search: (prev) => ({ ...prev, capability: prev.capability === key ? undefined : key }),
    });

  const removeTag = (tag: string) =>
    navigate({
      to: "/plugins",
      search: (prev) => {
        const next = (prev.tags ?? []).filter((t) => t !== tag);
        return { ...prev, tags: next.length > 0 ? next : undefined };
      },
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {CAPABILITY_TILES.map((tile) => {
        const active = capability === tile.key;
        return (
          <button
            key={tile.key}
            type="button"
            aria-pressed={active}
            onClick={() => toggleCapability(tile.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium text-sm transition-colors ${
              active
                ? "border-brand bg-brand/10 text-brand-ink"
                : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
            }`}
          >
            <tile.glyph className="size-3.5" />
            {tile.label}
          </button>
        );
      })}
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => removeTag(tag)}
          className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand/10 px-3 py-1.5 font-medium text-brand-ink text-sm transition-colors hover:bg-brand/20"
        >
          #{tag}
          <X className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
