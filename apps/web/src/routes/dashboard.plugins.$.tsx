import { Button, Input, Textarea } from "@brika/clay";
import type { PluginDetail } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  Ban,
  Check,
  ChevronRight,
  Globe,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { Segmented, segmentClassName } from "@/components/clay/segmented";
import { getPluginPage } from "@/lib/registry";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/plugins/$")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  loader: ({ params }) => (params._splat ? getPluginPage(params._splat) : null),
  component: EditListingPage,
});

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  ja: "日本語",
  zh: "中文",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  ko: "한국어",
};
const LOCALE_FULL: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  ja: "Japanese",
  zh: "Chinese",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  ko: "Korean",
};

function EditListingPage() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();

  if (data === null) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Listing not found</h1>
        <p className="mt-2 text-muted-foreground">That package isn't a Brika plugin on npm.</p>
      </main>
    );
  }

  return (
    <AdminShell login={user.login} activeLabel="My plugins">
      <EditListing detail={data.detail} locales={data.readmeLocales} />
    </AdminShell>
  );
}

interface ListingFields {
  displayName: string | null;
  summary: string | null;
  description: string | null;
  visibility: string;
}

/** Fetch the maintainer's stored override (null when none / not loaded). */
async function loadListing(name: string): Promise<ListingFields | null> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(name)}/listing`).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { listing?: ListingFields | null };
  return body.listing ?? null;
}

/** Persist the override; resolves to an error message, or null on success. */
async function putListing(name: string, fields: ListingFields): Promise<string | null> {
  const res = await fetch(`/api/plugins/${encodeURIComponent(name)}/listing`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "Could not save";
}

/**
 * The store-listing form state: seeds from the manifest, loads the maintainer's existing
 * override, and persists it. Extracted from the component so `EditListing` stays a thin view.
 */
function useListingForm(detail: PluginDetail) {
  const [name, setName] = useState(detail.displayName ?? detail.name);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState(detail.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadListing(detail.name).then((l) => {
      if (!active || l === null) return;
      setName(l.displayName ?? detail.displayName ?? detail.name);
      setSummary(l.summary ?? "");
      setDescription(l.description ?? detail.description ?? "");
      setVisibility(l.visibility === "unlisted" ? "unlisted" : "public");
    });
    return () => {
      active = false;
    };
  }, [detail.name, detail.displayName, detail.description]);

  async function save() {
    setSaving(true);
    setError(null);
    const message = await putListing(detail.name, {
      displayName: name.trim() || null,
      summary: summary.trim() || null,
      description: description.trim() || null,
      visibility,
    });
    setSaving(false);
    setError(message);
    if (message === null) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return {
    name,
    setName,
    summary,
    setSummary,
    description,
    setDescription,
    visibility,
    setVisibility,
    saving,
    saved,
    error,
    save,
  };
}

function EditListing({ detail, locales }: Readonly<{ detail: PluginDetail; locales: string[] }>) {
  const [lang, setLang] = useState(locales[0] ?? "en");
  const form = useListingForm(detail);
  const { name, setName, summary, setSummary, description, setDescription } = form;
  const { visibility, setVisibility, saving, saved, error, save } = form;

  const isTranslated = locales.includes(lang);
  const title = detail.displayName ?? detail.name;

  let saveLabel = "Save changes";
  if (saving) saveLabel = "Saving…";
  else if (saved) saveLabel = "Saved";

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
            Edit listing · {title}
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard/plugins"
            className="flex h-10 items-center rounded-xl border border-border px-4 font-semibold text-foreground text-sm transition-colors hover:bg-muted"
          >
            Cancel
          </Link>
          <Button onClick={save} disabled={saving} className="gap-1.5">
            <Check className="size-4" />
            {saveLabel}
          </Button>
        </div>
      </div>
      {error !== null && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* Icon */}
          <Card>
            <CardTitle icon={<ImageIcon className="size-4 text-brand-ink" />}>Icon</CardTitle>
            <div className="flex flex-wrap items-center gap-5">
              <PluginIcon
                name={detail.name}
                iconUrl={detail.iconUrl}
                capabilities={detail.capabilities}
                size={72}
              />
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2.5">
                  <span className="flex h-9 items-center gap-2 rounded-lg border border-border px-3.5 font-semibold text-foreground text-sm">
                    <Upload className="size-4" />
                    Upload icon
                  </span>
                  <span className="flex h-9 items-center px-3.5 font-semibold text-muted-foreground text-sm">
                    Remove
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">
                  PNG or SVG, square, at least 512×512px. Overrides the icon detected from npm.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
                Preview
              </span>
              <div className="flex items-end gap-5">
                <IconPreview detail={detail} size={44} label="card" />
                <IconPreview detail={detail} size={30} label="list" />
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                <Globe className="size-3.5" />
                Source: npm manifest
              </span>
            </div>
          </Card>

          {/* Listing details + language switcher */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Listing details</CardTitle>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Globe className="size-3.5" />
                  Language
                </span>
                <Segmented className="flex-wrap">
                  {locales.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      className={segmentClassName(code === lang, "sm")}
                    >
                      {code.toUpperCase()}
                    </button>
                  ))}
                </Segmented>
              </div>
            </div>
            {isTranslated ? (
              <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-600 text-xs dark:text-emerald-400">
                <Check className="size-3.5" />
                Translated. Shown to users in {LOCALE_FULL[lang] ?? lang}.
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-600 text-xs dark:text-amber-400">
                <Globe className="size-3.5" />
                {LOCALE_FULL[lang] ?? lang} isn't translated yet. Users see the English fallback
                below.
              </p>
            )}
            <Field label="Display name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Summary">
              <Input value={summary} onChange={(event) => setSummary(event.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </Card>

          {/* Supported languages */}
          <Card>
            <CardTitle icon={<Globe className="size-4 text-brand-ink" />}>
              Supported languages
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Detected from your package's{" "}
              <code className="font-mono text-foreground">locales/</code> directory. Toggle which
              translations appear in the store.
            </p>
            <div className="flex flex-wrap gap-2">
              {locales.map((code) =>
                code === "en" ? (
                  <span
                    key={code}
                    className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 font-semibold text-brand-ink text-xs"
                  >
                    <span>English</span>
                    <span className="font-bold text-[10px] opacity-70">DEFAULT</span>
                  </span>
                ) : (
                  <span
                    key={code}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 font-medium text-foreground text-xs"
                  >
                    {LOCALE_NAMES[code] ?? code}
                    <span className="text-muted-foreground">×</span>
                  </span>
                ),
              )}
              <span className="flex items-center gap-1.5 rounded-lg border border-border border-dashed px-3 py-1.5 font-semibold text-muted-foreground text-xs">
                <Plus className="size-3.5" />
                Add language
              </span>
            </div>
          </Card>

          {/* Keywords */}
          <Card>
            <CardTitle>Categories &amp; keywords</CardTitle>
            <div className="flex flex-wrap gap-2">
              {detail.keywords.slice(0, 8).map((keyword) => (
                <span
                  key={keyword}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 font-medium text-foreground text-xs"
                >
                  {keyword}
                  <span className="text-muted-foreground">×</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5 rounded-lg border border-border border-dashed px-3 py-1.5 font-semibold text-muted-foreground text-xs">
                <Plus className="size-3.5" />
                Add
              </span>
            </div>
          </Card>

          <VersionsCard name={detail.name} />
        </div>

        {/* sidebar */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
          <Card>
            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
              Synced from npm
            </span>
            <SideRow label="Version" value={detail.version} mono />
            {detail.license ? <SideRow label="License" value={detail.license} /> : null}
            <SideRow label="Brika engine" value={detail.brikaEngine} mono />
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
              Code &amp; versions come from npm and can't be edited here.
            </p>
          </Card>

          <Card>
            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
              Visibility
            </span>
            <Radio
              label="Public"
              checked={visibility === "public"}
              onSelect={() => setVisibility("public")}
            />
            <Radio
              label="Unlisted"
              checked={visibility === "unlisted"}
              onSelect={() => setVisibility("unlisted")}
            />
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

function Field({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the field control is passed as children
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}

function IconPreview({
  detail,
  size,
  label,
}: Readonly<{ detail: PluginDetail; size: number; label: string }>) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <PluginIcon
        name={detail.name}
        iconUrl={detail.iconUrl}
        capabilities={detail.capabilities}
        size={size}
      />
      <span className="font-mono text-[10.5px] text-muted-foreground">{label}</span>
    </div>
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
 * and yank/un-yank, hitting the console API (server-side ownership-gated). For npm-hosted
 * packages the versions endpoint 404s and we show a note instead.
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
          This package is hosted on npm. Version management (deprecate / yank) is available for
          plugins published to the Brika registry.
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

function Radio({
  label,
  checked,
  onSelect,
}: Readonly<{ label: string; checked: boolean; onSelect: () => void }>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-2.5 text-left font-medium text-foreground text-sm"
    >
      <span
        className={
          checked
            ? "size-4 rounded-full border-[5px] border-brand"
            : "size-4 rounded-full border border-border"
        }
      />
      {label}
    </button>
  );
}
