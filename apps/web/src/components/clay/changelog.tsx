import { cn } from "@brika/clay";
import type { PluginVersion } from "@brika/registry-contract";
import { formatDate } from "@/lib/format";

function bulletsFrom(changelog: string | undefined): string[] {
  if (!changelog) return [];
  return changelog
    .split("\n")
    .map((line) => line.replace(/^[\s*\-•]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 4);
}

/**
 * Vertical version timeline. Each row is a flex pair of a dot/line rail and the
 * release content; the line grows to fill the row so consecutive dots connect
 * with no gaps, regardless of how tall a release's notes are. The first entry
 * is highlighted as the latest.
 */
export function Changelog({
  versions,
  className,
}: Readonly<{ versions: PluginVersion[]; className?: string }>) {
  if (versions.length === 0) return null;
  return (
    <ol data-slot="changelog" className={cn("flex flex-col", className)}>
      {versions.map((entry, index) => {
        const isLast = index === versions.length - 1;
        const bullets = bulletsFrom(entry.changelog);
        return (
          <li key={entry.version} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  index === 0 ? "bg-brand" : "bg-border",
                )}
              />
              {isLast ? null : <span className="w-0.5 grow bg-border" />}
            </div>
            <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-6")}>
              <div className="flex flex-wrap items-center gap-2 leading-3">
                <span className="font-medium font-mono text-foreground text-sm">
                  v{entry.version}
                </span>
                {entry.publishedAt ? (
                  <span className="text-muted-foreground text-xs">
                    {formatDate(entry.publishedAt)}
                  </span>
                ) : null}
                {index === 0 ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-[10.5px] text-emerald-600 dark:text-emerald-400">
                    Latest
                  </span>
                ) : null}
                {entry.deprecated ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-[10.5px] text-amber-600 dark:text-amber-400">
                    Deprecated
                  </span>
                ) : null}
              </div>
              {bullets.length > 0 ? (
                <ul className="mt-2 flex list-disc flex-col gap-0.5 pl-4 text-muted-foreground text-sm leading-relaxed">
                  {bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
