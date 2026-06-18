import { Button, Input, Textarea } from "@brika/clay";
import {
  type DeveloperProfile,
  DeveloperProfile as DeveloperProfileSchema,
  type PluginSummary,
  SearchResponse,
} from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Box, Check, Copy, ExternalLink, Pencil, Plus, Rocket, ShieldCheck } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { AdminShell } from "../components/admin-shell";
import { GithubIcon } from "../components/clay/icons";
import { GradientAvatar, PluginIcon } from "../components/clay/plugin-icon";
import { LoginCard } from "../components/login-card";
import { formatCount } from "../lib/format";
import { useCurrentUser } from "../lib/use-current-user";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const WORKFLOW = `name: Publish plugin
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write # npm trusted publishing (OIDC)
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx brika check --types
      - run: npm publish --provenance --access public`;

function DashboardPage() {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </main>
    );
  }
  if (user === null) return <LoginCard />;
  return <AdminConsole login={user.login} avatarUrl={user.avatarUrl ?? undefined} />;
}

function AdminConsole({ login, avatarUrl }: Readonly<{ login: string; avatarUrl?: string }>) {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/account/profile")
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = DeveloperProfileSchema.safeParse(json);
        if (active && parsed.success) setProfile(parsed.data);
      });
    const maintainerQuery = encodeURIComponent(`maintainer:${login}`);
    fetch(`/v1/search?q=${maintainerQuery}&limit=50`)
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = SearchResponse.safeParse(json);
        if (active && parsed.success) setPlugins(parsed.data.plugins);
      });
    return () => {
      active = false;
    };
  }, [login]);

  const weekly = plugins.reduce((sum, p) => sum + p.downloadsWeekly, 0);
  const rated = plugins.filter((p) => p.rating);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, p) => sum + (p.rating?.average ?? 0), 0) / rated.length
      : 0;
  const verified = plugins.filter((p) => p.verified).length;

  return (
    <AdminShell login={login} activeLabel="My plugins">
      <section id="overview" className="flex scroll-mt-20 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-bold font-heading text-2xl tracking-tight">My plugins</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Manage how your packages appear in the store. Code &amp; versions sync from npm.
            </p>
          </div>
          <a
            href="#profile"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-brand-foreground shadow-[0_8px_18px_-8px_rgba(242,84,45,0.55)] transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            Publish plugin
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard label="Total plugins" value={String(plugins.length)} />
          <StatCard label="Weekly downloads" value={weekly > 0 ? formatCount(weekly) : "·"} />
          <StatCard label="Avg rating" value={avgRating > 0 ? avgRating.toFixed(1) : "·"} />
          <StatCard label="Verified" value={String(verified)} />
        </div>
      </section>

      <section id="plugins" className="flex scroll-mt-20 flex-col gap-3">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[2.4fr_1fr_1.2fr_44px] items-center gap-3 border-border border-b bg-muted/50 px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
            <span>Plugin</span>
            <span>Status</span>
            <span>Capabilities</span>
            <span />
          </div>
          {plugins.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Box className="size-7 text-muted-foreground" />
              <p className="font-medium text-foreground">No published plugins yet</p>
              <p className="text-muted-foreground text-sm">
                Plugins you maintain on npm (keyword <code>brika</code>) show up here.
              </p>
            </div>
          ) : (
            plugins.map((plugin) => <PluginRow key={plugin.name} plugin={plugin} />)
          )}
        </div>
      </section>

      {profile ? (
        <section id="profile" className="scroll-mt-20">
          <ProfileEditor profile={profile} onSaved={setProfile} avatarUrl={avatarUrl} />
        </section>
      ) : null}

      <PublishCard />
    </AdminShell>
  );
}

function StatCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-bold font-heading text-2xl text-foreground">{value}</span>
    </div>
  );
}

function PluginRow({ plugin }: Readonly<{ plugin: PluginSummary }>) {
  const caps = plugin.capabilities
    ? plugin.capabilities.tools +
      plugin.capabilities.blocks +
      plugin.capabilities.bricks +
      plugin.capabilities.sparks +
      plugin.capabilities.pages
    : 0;
  return (
    <div className="grid grid-cols-[2.4fr_1fr_1.2fr_44px] items-center gap-3 border-border border-b px-5 py-3.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <PluginIcon
          name={plugin.name}
          iconUrl={plugin.iconUrl}
          capabilities={plugin.capabilities}
          size={36}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-heading font-semibold text-foreground text-sm">
              {plugin.displayName ?? plugin.name}
            </span>
            {plugin.verified ? <ShieldCheck className="size-3.5 shrink-0 text-brand-ink" /> : null}
          </div>
          <div className="font-mono text-muted-foreground text-xs">v{plugin.version}</div>
        </div>
      </div>
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-600 text-xs dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-current" />
          <span>Published</span>
        </span>
      </div>
      <div className="text-muted-foreground text-sm">{caps > 0 ? `${caps} capabilities` : "·"}</div>
      <Link
        to="/dashboard/plugins/$"
        params={{ _splat: plugin.name }}
        aria-label={`Edit ${plugin.name}`}
        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
      >
        <Pencil className="size-4" />
      </Link>
    </div>
  );
}

function ProfileEditor({
  profile,
  onSaved,
  avatarUrl,
}: Readonly<{
  profile: DeveloperProfile;
  onSaved: (next: DeveloperProfile) => void;
  avatarUrl?: string;
}>) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const parsed = DeveloperProfileSchema.safeParse(await res.json());
      if (parsed.success) {
        onSaved(parsed.data);
        setSaved(true);
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold font-heading text-xl tracking-tight">Profile</h2>
        <Link
          to="/developers/$id"
          params={{ id: profile.id }}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          View public profile
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profile.id}
            className="size-16 rounded-[18px] border border-border object-cover"
          />
        ) : (
          <GradientAvatar
            seed={profile.id}
            label={profile.displayName ?? profile.id}
            size={64}
            className="rounded-[18px]"
          />
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-muted-foreground text-sm">
            <GithubIcon className="size-4" />@{profile.id}
            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px]">
              from npm
            </span>
          </div>
          <span className="text-muted-foreground text-xs">
            Identity is derived from your npm account.
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="profile-name" className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">Display name</span>
          <Input
            id="profile-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label htmlFor="profile-bio" className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">Bio</span>
          <Textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
          />
        </label>
        <label htmlFor="profile-website" className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">Website</span>
          <Input
            id="profile-website"
            type="url"
            placeholder="https://"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
              <Check className="size-4 text-brand-ink" />
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function PublishCard() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(WORKFLOW);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-bold font-heading text-xl tracking-tight">
        <Rocket className="size-5 text-brand-ink" />
        Publish from GitHub
      </h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted-foreground text-sm">
        <li>Push your plugin to a GitHub repository.</li>
        <li>
          On npmjs.com, add a <span className="font-medium text-foreground">trusted publisher</span>{" "}
          for the package, linked to that repo and workflow (tokenless OIDC).
        </li>
        <li>Add the workflow below as `.github/workflows/publish.yml`.</li>
        <li>
          Cut a GitHub release. It publishes to npm with provenance, and the store reflects the new
          version automatically.
        </li>
      </ol>
      <div className="relative">
        <pre className="overflow-auto rounded-xl border border-border bg-muted/50 p-4 font-mono text-xs">
          {WORKFLOW}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy workflow"
          className="absolute top-2 right-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-4 text-brand-ink" /> : <Copy className="size-4" />}
        </button>
      </div>
      <a
        href="https://docs.npmjs.com/trusted-publishers"
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-brand-ink text-sm hover:underline"
      >
        npm trusted publishing docs
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}
