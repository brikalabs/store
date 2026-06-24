import { Card, Input } from "@brika/clay";
import { Archive, Ban, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Pager, usePagedList } from "@/components/clay/pagination";
import { Pill } from "@/components/clay/pill";
import { type PkgVersion, usePluginVersions } from "@/hooks/use-plugin-versions";
import { formatBytes, formatDate } from "@/lib/format";

const PAGE_SIZE = 8;

/**
 * Per-version management for registry-hosted plugins: deprecate and yank (server-side
 * ownership-gated). For packages not published to the registry the endpoint 404s; we show a note.
 */
export function VersionsCard({ name }: Readonly<{ name: string }>) {
  const { state, notRegistry, error, pending, act } = usePluginVersions(name);
  const [query, setQuery] = useState("");

  const versions = state?.versions ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle === ""
      ? versions
      : versions.filter((v) => v.version.toLowerCase().includes(needle));
  }, [versions, query]);
  const { pageItems, pagination, setPage } = usePagedList(filtered, PAGE_SIZE);

  if (notRegistry) {
    return (
      <Card className="flex flex-col gap-3.5 rounded-[20px] p-[22px] shadow-sm">
        <Header total={null} />
        <p className="text-muted-foreground text-sm">
          Version management is available for plugins published to the Brika registry.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex min-w-0 flex-col gap-3.5 rounded-[20px] p-[22px] shadow-sm">
      <Header total={state?.versions.length ?? null} />

      {error !== null && (
        <p className="rounded-[10px] border border-danger-border bg-danger-tint px-3 py-2 text-danger text-xs">
          {error}
        </p>
      )}

      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search version, e.g. 2.4"
          className="pl-9 font-mono"
        />
      </div>

      {state === null ? (
        <div className="h-40 animate-pulse rounded-[14px] bg-muted" />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border">
          {pageItems.length === 0 ? (
            <div className="px-4 py-9 text-center text-muted-foreground text-sm">
              No version matches that search.
            </div>
          ) : (
            pageItems.map((v) => (
              <VersionRow
                key={v.version}
                name={name}
                version={v}
                isLatest={v.version === state.latest}
                canManage={state.canManage}
                pending={pending}
                onAct={act}
              />
            ))
          )}
        </div>
      )}

      <Pager pagination={pagination} onPageChange={setPage} />

      {state !== null && !state.canManage ? (
        <p className="text-muted-foreground text-xs">
          You can manage versions only for scopes you belong to.
        </p>
      ) : null}
    </Card>
  );
}

function Header({ total }: Readonly<{ total: number | null }>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 font-bold font-heading text-foreground text-lg tracking-tight">
        <Archive className="size-4 text-brand-ink" />
        Versions
      </h2>
      {total !== null && (
        <span className="text-[12.5px] text-muted-foreground">{total} published</span>
      )}
    </div>
  );
}

const ACTION_BASE =
  "inline-flex size-[30px] items-center justify-center rounded-lg border border-input bg-card text-muted-foreground transition-colors disabled:opacity-50";

function VersionRow({
  name,
  version,
  isLatest,
  canManage,
  pending,
  onAct,
}: Readonly<{
  name: string;
  version: PkgVersion;
  isLatest: boolean;
  canManage: boolean;
  pending: string | null;
  onAct: (path: string, body: unknown, key: string) => void;
}>) {
  const v = version.version;
  const deprecated = version.deprecated !== null;
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-border border-b px-3.5 py-2.5 last:border-b-0">
      <span className="min-w-[58px] font-mono font-semibold text-foreground text-sm">{v}</span>
      <VersionTags isLatest={isLatest} deprecated={deprecated} yanked={version.yanked} />
      <span className="text-[12px] text-muted-foreground">{formatDate(version.publishedAt)}</span>
      <span className="font-mono text-[11.5px] text-muted-foreground/70">
        {formatBytes(version.size)}
      </span>
      <div className="flex-1" />
      {canManage ? (
        <RowActions
          name={name}
          version={version}
          deprecated={deprecated}
          pending={pending}
          onAct={onAct}
        />
      ) : null}
    </div>
  );
}

function VersionTags({
  isLatest,
  deprecated,
  yanked,
}: Readonly<{ isLatest: boolean; deprecated: boolean; yanked: boolean }>) {
  return (
    <>
      {isLatest ? (
        <Pill tone="brand" className="py-0.5 text-[11px] font-bold">
          latest
        </Pill>
      ) : null}
      {deprecated ? (
        <Pill tone="warning" className="py-0.5 text-[11px] font-bold">
          deprecated
        </Pill>
      ) : null}
      {yanked ? (
        <Pill tone="danger" className="py-0.5 text-[11px] font-bold">
          yanked
        </Pill>
      ) : null}
    </>
  );
}

function RowActions({
  name,
  version,
  deprecated,
  pending,
  onAct,
}: Readonly<{
  name: string;
  version: PkgVersion;
  deprecated: boolean;
  pending: string | null;
  onAct: (path: string, body: unknown, key: string) => void;
}>) {
  const v = version.version;
  return (
    <>
      <button
        type="button"
        title={deprecated ? "Un-deprecate" : "Deprecate"}
        aria-label={deprecated ? "Un-deprecate" : "Deprecate"}
        disabled={pending === `dep:${v}`}
        onClick={() =>
          onAct(
            "/api/plugins/deprecate",
            { name, version: v, message: deprecated ? null : "Deprecated by the maintainer" },
            `dep:${v}`,
          )
        }
        className={`${ACTION_BASE} ${deprecated ? "border-warning-border text-warning" : "hover:border-warning-border hover:text-warning"}`}
      >
        {deprecated ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}
      </button>
      <button
        type="button"
        title={version.yanked ? "Un-yank" : "Yank"}
        aria-label={version.yanked ? "Un-yank" : "Yank"}
        disabled={pending === `yank:${v}`}
        onClick={() =>
          onAct("/api/plugins/yank", { name, version: v, yanked: !version.yanked }, `yank:${v}`)
        }
        className={`${ACTION_BASE} ${version.yanked ? "border-danger-border text-danger" : "hover:border-danger-border hover:text-danger"}`}
      >
        {version.yanked ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
      </button>
    </>
  );
}
