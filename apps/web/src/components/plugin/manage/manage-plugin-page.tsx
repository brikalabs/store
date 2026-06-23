import { Button } from "@brika/clay";
import type { PluginDetail } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { SettingsCard, SideRow } from "@/components/clay/settings-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { DangerRow, DangerZone } from "@/components/layout/danger-zone";
import { StatusBadge } from "@/components/plugin/status-badge";
import { TrustedPublishersCard } from "@/components/scope/trusted-publishers-card";
import { useIsScopeAdmin } from "@/hooks/use-scopes";
import { formatCount, formatDate } from "@/lib/format";
import { VersionsCard } from "./versions-card";

export interface ManageData {
  readonly name: string;
  /**
   * The public detail, or null when no installable (non-yanked) version exists. We never 404 a
   * hosted package here so the owner can still reach this page to un-yank.
   */
  readonly detail: PluginDetail | null;
  /** True when the name is reserved (the package row exists but nothing is published yet). */
  readonly reserved: boolean;
}

const route = getRouteApi("/dashboard/plugins/$");

export function ManagePluginPage() {
  const data = route.useLoaderData();
  const { user } = route.useRouteContext();

  if (data === null) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          Listing not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          That package isn't published to the Brika registry.
        </p>
      </main>
    );
  }

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="My plugins">
      <ManagePlugin name={data.name} detail={data.detail} reserved={data.reserved} />
    </AdminShell>
  );
}

function ManagePlugin({ name, detail, reserved }: Readonly<ManageData>) {
  const scope = scopeOf(name);
  const isAdmin = useIsScopeAdmin(scope);

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-muted-foreground">
          <Link to="/dashboard/plugins" className="transition-colors hover:text-brand-ink">
            My plugins
          </Link>
          <span>/</span>
          <span className="text-foreground">{name}</span>
        </div>

        <PluginHeader name={name} detail={detail} reserved={reserved} />

        {detail ? <StatStrip detail={detail} /> : null}
      </div>

      <StateBanner detail={detail} reserved={reserved} />

      <div className="grid items-start gap-[18px] lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <VersionsCard name={name} />

        <aside className="flex flex-col gap-3.5">
          {detail ? (
            <SettingsCard>
              <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
                Synced from the registry
              </span>
              <div className="flex flex-col">
                <SideRow label="Latest" value={detail.version} mono />
                {detail.license ? <SideRow label="License" value={detail.license} mono /> : null}
                <SideRow label="Brika engine" value={detail.brikaEngine} mono />
              </div>
              <p className="rounded-[11px] bg-muted px-3 py-2.5 text-muted-foreground text-xs leading-relaxed">
                Code &amp; versions come from the published package and can't be edited here.
              </p>
            </SettingsCard>
          ) : null}

          <SettingsCard className="gap-2.5">
            <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
              Version management
            </span>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Deprecate or yank individual published versions. Yanked versions stay installable for
              existing lockfiles but are hidden from new installs.
            </p>
          </SettingsCard>
        </aside>
      </div>

      {scope ? <PluginTrustedPublishers scope={scope} isAdmin={isAdmin} /> : null}

      {scope && isAdmin ? <PluginDangerZone name={name} /> : null}
    </div>
  );
}

function PluginHeader({ name, detail, reserved }: Readonly<ManageData>) {
  const title = detail?.displayName ?? name;
  const grants = detail ? Object.keys(detail.grants ?? {}) : [];

  return (
    <div className="mt-3.5 flex items-start gap-[18px]">
      <PluginIcon
        name={name}
        iconUrl={detail?.iconUrl}
        capabilities={detail?.capabilities}
        size={64}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-bold font-heading text-[27px] text-foreground tracking-tight">
            {title}
          </h1>
          {detail ? <StatusBadge status={detail.listingStatus} /> : null}
          {!detail && reserved ? <StatusBadge status="reserved" /> : null}
          {detail ? (
            <span className="font-mono text-[13px] text-muted-foreground">v{detail.version}</span>
          ) : null}
        </div>
        {detail?.description ? (
          <p className="mt-1.5 max-w-[620px] text-[14.5px] text-muted-foreground leading-relaxed">
            {detail.description}
          </p>
        ) : null}
        <GrantChips grants={grants} />
      </div>
      {reserved ? null : (
        <Button asChild variant="outline" className="shrink-0">
          <a href={`/${name}`}>
            <ExternalLink className="size-4" />
            View listing
          </a>
        </Button>
      )}
    </div>
  );
}

function GrantChips({ grants }: Readonly<{ grants: readonly string[] }>) {
  if (grants.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {grants.map((grant) => (
        <span
          key={grant}
          className="inline-flex h-[27px] items-center rounded-lg border border-input bg-muted px-2.5 font-mono text-[12px] text-muted-foreground"
        >
          {grant}
        </span>
      ))}
    </div>
  );
}

function StatStrip({ detail }: Readonly<{ detail: PluginDetail }>) {
  return (
    <div className="mt-[18px] grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-border bg-border shadow-sm sm:grid-cols-4">
      <Stat
        label="Weekly downloads"
        value={detail.downloadsWeekly > 0 ? formatCount(detail.downloadsWeekly) : "·"}
      />
      <Stat
        label="Rating"
        value={detail.rating ? detail.rating.average.toFixed(1) : "·"}
        star={detail.rating !== undefined}
      />
      <Stat label="License" value={detail.license ?? "·"} mono />
      <Stat label="Updated" value={formatDate(detail.updatedAt) || "·"} />
    </div>
  );
}

function StateBanner({
  detail,
  reserved,
}: Readonly<{ detail: PluginDetail | null; reserved: boolean }>) {
  if (detail !== null) return null;
  if (reserved) {
    return (
      <p className="rounded-[14px] border border-border bg-muted px-4 py-3 text-muted-foreground text-sm leading-relaxed">
        This name is <strong className="font-semibold text-foreground">reserved</strong>. Publish
        your first version from CI or the CLI to make it live; until then it stays hidden from the
        store. Set up a trusted publisher below to publish without a token.
      </p>
    );
  }
  return (
    <p className="rounded-[14px] border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
      This package has no installable version right now, so it's hidden from the storefront and new
      installs. It stays here for you to manage - un-yank a version below to relist it.
    </p>
  );
}

function Stat({
  label,
  value,
  mono = false,
  star = false,
}: Readonly<{ label: string; value: string; mono?: boolean; star?: boolean }>) {
  return (
    <div className="bg-card px-[18px] py-3.5">
      <div className="font-bold text-[11px] text-muted-foreground uppercase tracking-[0.05em]">
        {label}
      </div>
      <div
        className={`mt-1 flex items-center gap-1.5 text-foreground ${
          mono ? "font-mono font-semibold text-base" : "font-bold font-heading text-[19px]"
        }`}
      >
        {star ? <Star className="size-4 text-star" /> : null}
        {value}
      </div>
    </div>
  );
}

/**
 * Trusted publishers are bound to the scope (a scope is the account), so this manages the
 * scope's bindings - which authorize CI to publish this plugin. Admin-gated for add/remove.
 */
function PluginTrustedPublishers({
  scope,
  isAdmin,
}: Readonly<{ scope: string; isAdmin: boolean }>) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {error !== null && (
        <p className="rounded-[10px] border border-danger-border bg-danger-tint px-3 py-2 text-danger text-xs">
          {error}
        </p>
      )}
      <TrustedPublishersCard scope={scope} isAdmin={isAdmin} onError={setError} />
    </div>
  );
}

/** Irreversible per-plugin actions. Permanently deletes the package after a typed confirmation. */
function PluginDangerZone({ name }: Readonly<{ name: string }>) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    const res = await fetch("/api/plugins/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      navigate({ to: "/dashboard/plugins" });
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Could not delete this plugin.");
  }

  return (
    <DangerZone>
      {error !== null && <p className="text-danger text-xs">{error}</p>}
      <DangerRow
        title="Delete this plugin"
        description="Permanently removes the listing and every published version. Install ids stop resolving for everyone. This cannot be undone."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            className="border-danger text-danger hover:bg-danger hover:text-white"
          >
            <Trash2 className="size-4" />
            Delete plugin
          </Button>
        }
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this plugin"
        description={
          <>
            This permanently removes <span className="font-mono text-foreground">{name}</span> and
            every published version; install ids stop resolving for everyone. This cannot be undone.
            Type the package name to confirm.
          </>
        }
        confirmLabel="Delete plugin"
        confirmWord={name}
        onConfirm={remove}
      />
    </DangerZone>
  );
}
