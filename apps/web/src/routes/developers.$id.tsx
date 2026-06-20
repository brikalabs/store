import { createFileRoute } from "@tanstack/react-router";
import { Box, Link2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { PluginCard, Stat } from "@/components/clay/plugin-card";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { formatCount } from "@/lib/format";
import { getDeveloperPage } from "@/lib/registry";

function SocialIcon({
  href,
  label,
  children,
}: Readonly<{ href: string; label: string; children: ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </a>
  );
}

export const Route = createFileRoute("/developers/$id")({
  loader: ({ params }) => getDeveloperPage(params.id),
  component: DeveloperPage,
});

function DeveloperPage() {
  const { profile, plugins } = Route.useLoaderData();
  const name = profile.displayName ?? profile.id;

  const weekly = plugins.reduce((sum, p) => sum + p.downloadsWeekly, 0);
  const rated = plugins.filter((p) => p.rating);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, p) => sum + (p.rating?.average ?? 0), 0) / rated.length
      : 0;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={name}
            className="size-20 shrink-0 rounded-[20px] border border-border object-cover"
          />
        ) : (
          <GradientAvatar seed={profile.id} label={name} size={84} className="rounded-[20px]" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold font-heading text-3xl tracking-tight">{name}</h1>
            {profile.verified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 font-semibold text-brand-ink text-xs">
                <ShieldCheck className="size-3.5" />
                Verified
              </span>
            ) : null}
          </div>
          <div className="mt-1 font-mono text-muted-foreground text-sm">@{profile.id}</div>
          {profile.bio ? (
            <p className="mt-3 max-w-xl text-muted-foreground leading-relaxed">{profile.bio}</p>
          ) : null}
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            {profile.website ? (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
              >
                <Link2 className="size-4" />
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
            <SocialIcon
              href={`https://github.com/${profile.githubLogin ?? profile.id}`}
              label="GitHub"
            >
              <GithubIcon className="size-4" />
            </SocialIcon>
            <SocialIcon href={`https://www.npmjs.com/~${profile.id}`} label="npm">
              <Box className="size-4" />
            </SocialIcon>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Stat value={String(profile.pluginCount || plugins.length)} label="plugins" />
          {weekly > 0 ? <Stat value={`${formatCount(weekly)}`} label="weekly" /> : null}
          {avgRating > 0 ? <Stat value={avgRating.toFixed(1)} label="avg rating" /> : null}
        </div>
      </header>

      <div className="h-px bg-border" />

      <section className="flex flex-col gap-4">
        <h2 className="font-bold font-heading text-xl tracking-tight">
          Plugins <span className="font-medium text-muted-foreground">{plugins.length}</span>
        </h2>
        {plugins.length === 0 ? (
          <p className="text-muted-foreground text-sm">No published Brika plugins found.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((plugin) => (
              <PluginCard key={plugin.name} plugin={plugin} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
