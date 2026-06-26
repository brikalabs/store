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
import { TakedownBanner } from "@/components/layout/takedown-banner";
import { StatusBadge } from "@/components/plugin/status-badge";
import { TrustedPublishersCard } from "@/components/scope/trusted-publishers-card";
import { usePluginDeletion } from "@/hooks/use-plugin-deletion";
import { useIsScopeAdmin } from "@/hooks/use-scopes";
import { useDateFormat, useT } from "@/i18n";
import { formatCount } from "@/lib/format";
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
  /** Operator takedown reason (whole-plugin or its scope), shown to the owner; null when active. */
  readonly takedown: string | null;
}

const route = getRouteApi("/dashboard/plugins/$");

export function ManagePluginPage() {
  const t = useT();
  const data = route.useLoaderData();
  const { user } = route.useRouteContext();

  if (data === null) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          {t("pluginManage:listingNotFound")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("pluginManage:notPublished")}</p>
      </main>
    );
  }

  return (
    <AdminShell
      id={user.id}
      name={user.name}
      avatarUrl={user.avatarUrl}
      activeLabel={t("pluginManage:myPlugins")}
    >
      <ManagePlugin
        name={data.name}
        detail={data.detail}
        reserved={data.reserved}
        takedown={data.takedown}
      />
    </AdminShell>
  );
}

function ManagePlugin({ name, detail, reserved, takedown }: Readonly<ManageData>) {
  const t = useT();
  const scope = scopeOf(name);
  const isAdmin = useIsScopeAdmin(scope);

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-muted-foreground">
          <Link to="/dashboard/plugins" className="transition-colors hover:text-brand-ink">
            {t("pluginManage:myPlugins")}
          </Link>
          <span>/</span>
          <span className="text-foreground">{name}</span>
        </div>

        <PluginHeader name={name} detail={detail} reserved={reserved} />

        {detail ? <StatStrip detail={detail} /> : null}
      </div>

      {takedown === null ? (
        <StateBanner detail={detail} reserved={reserved} />
      ) : (
        <TakedownBanner reason={takedown} subject="plugin" />
      )}

      <div className="grid items-start gap-[18px] lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <VersionsCard name={name} />

        <aside className="flex flex-col gap-3.5">
          {detail ? (
            <SettingsCard>
              <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
                {t("pluginManage:syncedFromRegistry")}
              </span>
              <div className="flex flex-col">
                <SideRow label={t("pluginManage:sideLatest")} value={detail.version} mono />
                {detail.license ? (
                  <SideRow label={t("pluginManage:sideLicense")} value={detail.license} mono />
                ) : null}
                <SideRow
                  label={t("pluginManage:sideBrikaEngine")}
                  value={detail.brikaEngine}
                  mono
                />
              </div>
              <p className="rounded-[11px] bg-muted px-3 py-2.5 text-muted-foreground text-xs leading-relaxed">
                {t("pluginManage:codeNotEditable")}
              </p>
            </SettingsCard>
          ) : null}

          <SettingsCard className="gap-2.5">
            <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
              {t("pluginManage:versionManagement")}
            </span>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("pluginManage:versionManagementDescription")}
            </p>
          </SettingsCard>
        </aside>
      </div>

      {scope ? <PluginTrustedPublishers scope={scope} isAdmin={isAdmin} /> : null}

      {scope && isAdmin ? <PluginDangerZone name={name} /> : null}
    </div>
  );
}

function PluginHeader({
  name,
  detail,
  reserved,
}: Readonly<Pick<ManageData, "name" | "detail" | "reserved">>) {
  const t = useT();
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
            {name}
          </h1>
          {detail ? <StatusBadge status={detail.listingStatus} /> : null}
          {!detail && reserved ? <StatusBadge status="reserved" /> : null}
          {detail ? (
            <span className="font-mono text-[13px] text-muted-foreground">v{detail.version}</span>
          ) : null}
        </div>
        {detail?.displayName && detail.displayName !== name ? (
          <p className="mt-0.5 text-muted-foreground text-sm">{detail.displayName}</p>
        ) : null}
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
            {t("pluginManage:viewListing")}
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
  const t = useT();
  const date = useDateFormat();
  return (
    <div className="mt-[18px] grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-border bg-border shadow-sm sm:grid-cols-4">
      <Stat
        label={t("pluginManage:statWeeklyDownloads")}
        value={detail.downloadsWeekly > 0 ? formatCount(detail.downloadsWeekly) : "·"}
      />
      <Stat
        label={t("pluginManage:statRating")}
        value={detail.rating ? detail.rating.average.toFixed(1) : "·"}
        star={detail.rating !== undefined}
      />
      <Stat label={t("pluginManage:statLicense")} value={detail.license ?? "·"} mono />
      <Stat label={t("pluginManage:statUpdated")} value={date(detail.updatedAt) || "·"} />
    </div>
  );
}

function StateBanner({
  detail,
  reserved,
}: Readonly<{ detail: PluginDetail | null; reserved: boolean }>) {
  const t = useT();
  if (detail !== null) return null;
  if (reserved) {
    return (
      <p className="rounded-[14px] border border-border bg-muted px-4 py-3 text-muted-foreground text-sm leading-relaxed">
        {t("pluginManage:reservedBanner")}
      </p>
    );
  }
  return (
    <p className="rounded-[14px] border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
      {t("pluginManage:noInstallableBanner")}
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
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { error, remove } = usePluginDeletion(name);

  // Navigate away only on a successful delete; the hook surfaces a failure through `error`.
  async function confirmDelete() {
    if (await remove()) navigate({ to: "/dashboard/plugins" });
  }

  return (
    <DangerZone>
      {error !== null && <p className="text-danger text-xs">{error}</p>}
      <DangerRow
        title={t("pluginManage:deletePluginTitle")}
        description={t("pluginManage:deletePluginDescription")}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            className="border-danger text-danger hover:bg-danger hover:text-white"
          >
            <Trash2 className="size-4" />
            {t("pluginManage:deletePlugin")}
          </Button>
        }
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("pluginManage:deletePluginTitle")}
        description={
          <>
            {t("pluginManage:deleteConfirmBefore")}{" "}
            <span className="font-mono text-foreground">{name}</span>{" "}
            {t("pluginManage:deleteConfirmAfter")}
          </>
        }
        confirmLabel={t("pluginManage:deletePlugin")}
        confirmWord={name}
        onConfirm={confirmDelete}
      />
    </DangerZone>
  );
}
