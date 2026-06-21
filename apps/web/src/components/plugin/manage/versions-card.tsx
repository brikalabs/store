import { Archive, Ban, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Card, CardTitle } from "./card";

interface PkgVersion {
  version: string;
  publishedAt: string;
  deprecated: string | null;
  yanked: boolean;
  takedownReason: string | null;
}

interface VersionsState {
  name: string;
  latest: string | null;
  canManage: boolean;
  versions: PkgVersion[];
}

const VERSION_ACTION =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-medium text-foreground text-xs transition-colors hover:bg-muted disabled:opacity-50";

/**
 * Real per-version management for registry-hosted (`@brika`) plugins: deprecate/un-deprecate
 * and yank/un-yank, hitting the console API (server-side ownership-gated). For packages not
 * published to the registry the versions endpoint 404s and we show a note instead.
 */
export function VersionsCard({ name }: Readonly<{ name: string }>) {
  const [state, setState] = useState<VersionsState | null>(null);
  const [notRegistry, setNotRegistry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/plugins/versions?name=${encodeURIComponent(name)}`);
    if (res.status === 404) {
      setNotRegistry(true);
      return;
    }
    if (res.ok) {
      const data: VersionsState = await res.json();
      setState(data);
    }
  }, [name]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(path: string, body: unknown, key: string) {
    setPending(key);
    setError(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(null);
    if (res.ok) {
      await load();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Action failed");
    }
  }

  if (notRegistry) {
    return (
      <Card>
        <CardTitle icon={<Archive className="size-4 text-brand-ink" />}>Versions</CardTitle>
        <p className="text-muted-foreground text-sm">
          Version management is available for plugins published to the Brika registry.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle icon={<Archive className="size-4 text-brand-ink" />}>Versions</CardTitle>
      {error !== null && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-xs">
          {error}
        </p>
      )}
      {state === null ? (
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {state.versions.map((v) => (
            <VersionRow
              key={v.version}
              name={name}
              version={v}
              isLatest={v.version === state.latest}
              canManage={state.canManage}
              pending={pending}
              onAct={act}
            />
          ))}
        </ul>
      )}
      {state !== null && !state.canManage && (
        <p className="text-muted-foreground text-xs">
          You can manage versions only for scopes you belong to.
        </p>
      )}
    </Card>
  );
}

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
    <li className="flex flex-wrap items-center gap-2 py-3">
      <span className="font-mono font-semibold text-foreground text-sm">{v}</span>
      {isLatest ? (
        <span className="rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-[11px] text-brand-ink">
          latest
        </span>
      ) : null}
      {deprecated ? (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-[11px] text-amber-600 dark:text-amber-400">
          deprecated
        </span>
      ) : null}
      {version.yanked ? (
        <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-semibold text-[11px] text-destructive">
          yanked
        </span>
      ) : null}
      {canManage ? (
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={pending === `dep:${v}`}
            onClick={() =>
              onAct(
                "/api/plugins/deprecate",
                { name, version: v, message: deprecated ? null : "Deprecated by the maintainer" },
                `dep:${v}`,
              )
            }
            className={VERSION_ACTION}
          >
            {deprecated ? <RotateCcw className="size-3.5" /> : <Archive className="size-3.5" />}
            {deprecated ? "Un-deprecate" : "Deprecate"}
          </button>
          <button
            type="button"
            disabled={pending === `yank:${v}`}
            onClick={() =>
              onAct("/api/plugins/yank", { name, version: v, yanked: !version.yanked }, `yank:${v}`)
            }
            className={VERSION_ACTION}
          >
            {version.yanked ? <RotateCcw className="size-3.5" /> : <Ban className="size-3.5" />}
            {version.yanked ? "Un-yank" : "Yank"}
          </button>
        </div>
      ) : null}
    </li>
  );
}
