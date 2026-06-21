import type { PluginDetail } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Ban, ChevronRight, RotateCcw } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getPluginPage } from "@/lib/registry/registry";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/plugins/$")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  loader: ({ params }) => (params._splat ? getPluginPage(params._splat) : null),
  component: ManagePluginPage,
});

function ManagePluginPage() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  if (data === null) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Listing not found</h1>
        <p className="mt-2 text-muted-foreground">
          That package isn't published to the Brika registry.
        </p>
      </main>
    );
  }

  return (
    <AdminShell id={user.id} name={user.name} activeLabel="My plugins">
      <ManagePlugin detail={data.detail} />
    </AdminShell>
  );
}

function ManagePlugin({ detail }: Readonly<{ detail: PluginDetail }>) {
  const title = detail.displayName ?? detail.name;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
            <Link to="/dashboard/plugins" className="hover:text-foreground">
              My plugins
            </Link>
            <ChevronRight className="size-3" />
            {detail.name}
          </div>
          <h1 className="mt-1.5 font-bold font-heading text-2xl tracking-tight">
            Manage · {title}
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <div className="flex flex-col gap-5">
          <VersionsCard name={detail.name} />
        </div>

        {/* sidebar */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
          <Card>
            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
              Synced from the registry
            </span>
            <SideRow label="Version" value={detail.version} mono />
            {detail.license ? <SideRow label="License" value={detail.license} /> : null}
            <SideRow label="Brika engine" value={detail.brikaEngine} mono />
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
              Code &amp; versions come from the published package and can't be edited here.
            </p>
          </Card>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
              Version management
            </span>
            <p className="text-muted-foreground text-xs">
              Deprecate or yank individual published versions in the{" "}
              <span className="font-semibold text-foreground">Versions</span> panel. Yanked versions
              stay installable for existing lockfiles but are hidden from new installs.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      {children}
    </div>
  );
}

function CardTitle({ children, icon }: Readonly<{ children: ReactNode; icon?: ReactNode }>) {
  return (
    <h2 className="flex items-center gap-2 font-bold font-heading text-base tracking-tight">
      {icon}
      {children}
    </h2>
  );
}

function SideRow({
  label,
  value,
  mono,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          mono ? "font-semibold font-mono text-foreground" : "font-semibold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

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
function VersionsCard({ name }: Readonly<{ name: string }>) {
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
