import type { PluginSummary, Review, UserProfile } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { listScopesForMember } from "@brika/store-db/adapters";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { MessageSquare, Star } from "lucide-react";
import { LinkIcon } from "@/components/clay/link-icon";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { Stars } from "@/components/clay/stars";
import { NotFoundPage } from "@/components/feedback/error-pages";
import { ShowcaseCard, Stat } from "@/components/plugin/showcase-card";
import { formatCount } from "@/lib/format";
import { searchPlugins } from "@/lib/registry/registry";
import { getUserProfile, listReviewsByUser } from "@/lib/social/social";
import { users } from "@/server/db/schema";
import { registryDb } from "@/server/registry-services";
import { serverContext } from "@/server/server-context";

interface UserPage {
  readonly profile: UserProfile;
  readonly plugins: PluginSummary[];
  readonly reviews: Review[];
}

// Upper bound for the catalog scan when filtering to the account's owned scopes.
// Mirrors `getScopePage`: the hosted catalog is bounded, so one capped read covers it.
const CATALOG_SCAN = 200;

/**
 * The public account profile page data (USER-002), resolved by the opaque account
 * id (`users.id`). A server function so the D1 reads (the social DB + the `reg_*`
 * scope membership) always run on the server, even on a client-side navigation.
 * Returns null for an unknown id so the route 404s.
 *
 * The published plugins are derived by OWNERSHIP, never npm: the account's GitHub
 * login -> its scope memberships -> the catalog plugins under those scopes (the same
 * ownership filter `getScopePage` applies). Reviews are the social reviews the
 * account authored.
 */
const fetchUserPage = createServerFn()
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<UserPage | null> => {
    const { db } = serverContext();
    const profile = await getUserProfile(db, id);
    if (profile === null) return null;

    const loginRows = await db
      .select({ login: users.login })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const login = loginRows[0]?.login;

    const [scopes, { plugins: catalog }, reviews] = await Promise.all([
      login ? listScopesForMember(registryDb(), "github", login) : Promise.resolve([]),
      searchPlugins(undefined, CATALOG_SCAN, 0),
      listReviewsByUser(db, id),
    ]);
    const owned = new Set(scopes.map((s) => s.scope));
    const plugins = catalog.filter((plugin) => {
      const scope = scopeOf(plugin.name);
      return scope !== null && owned.has(scope);
    });

    return { profile, plugins, reviews };
  });

export const Route = createFileRoute("/u/$id")({
  loader: ({ params }) => fetchUserPage({ data: params.id }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const data = Route.useLoaderData();
  if (data === null) return <NotFoundPage />;
  return <UserProfileView page={data} />;
}

function UserProfileView({ page }: Readonly<{ page: UserPage }>) {
  const { profile, plugins, reviews } = page;
  const name = profile.displayName ?? profile.id;
  const weekly = plugins.reduce((sum, plugin) => sum + plugin.downloadsWeekly, 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={name}
            className="size-[84px] shrink-0 rounded-[20px] border border-border object-cover"
          />
        ) : (
          <GradientAvatar seed={profile.id} label={name} size={84} className="rounded-[20px]" />
        )}
        <div className="flex-1">
          <h1 className="font-bold font-heading text-3xl tracking-tight">{name}</h1>
          {profile.bio !== undefined && profile.bio.length > 0 ? (
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">{profile.bio}</p>
          ) : null}
          {profile.website !== undefined || profile.links.length > 0 ? (
            <ul className="mt-3.5 flex flex-wrap items-center gap-2">
              {profile.website !== undefined ? (
                <li key={`website:${profile.website}`}>
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
                  >
                    <LinkIcon url={profile.website} className="size-4 text-muted-foreground" />
                    Website
                  </a>
                </li>
              ) : null}
              {profile.links.map((link) => (
                <li key={`${link.label}:${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
                  >
                    <LinkIcon url={link.url} className="size-4 text-muted-foreground" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex gap-2.5">
          <Stat value={String(plugins.length)} label="plugins" />
          {reviews.length > 0 ? <Stat value={String(reviews.length)} label="reviews" /> : null}
          {weekly > 0 ? <Stat value={formatCount(weekly)} label="installs / week" /> : null}
        </div>
      </header>

      <div className="h-px bg-border" />

      <section className="flex flex-col gap-4">
        <h2 className="font-bold font-heading text-xl tracking-tight">
          Plugins <span className="font-medium text-muted-foreground">{plugins.length}</span>
        </h2>
        {plugins.length === 0 ? (
          <p className="text-muted-foreground text-sm">No published Brika plugins yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((plugin) => (
              <ShowcaseCard key={plugin.name} plugin={plugin} />
            ))}
          </div>
        )}
      </section>

      {reviews.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-bold font-heading text-xl tracking-tight">
            Reviews <span className="font-medium text-muted-foreground">{reviews.length}</span>
          </h2>
          <div className="flex flex-col gap-3">
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

/** A single authored review on the profile page: plugin link, stars, and body. */
function ReviewRow({ review }: Readonly<{ review: Review }>) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          to="/$"
          params={{ _splat: review.pluginName }}
          className="font-semibold text-brand-ink text-sm hover:underline"
        >
          {review.pluginName}
        </Link>
        <span className="inline-flex items-center gap-1 text-amber-500">
          <Stars value={review.rating} starClassName="size-3.5" />
        </span>
        {review.helpfulCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
            <MessageSquare className="size-3.5" />
            {review.helpfulCount} found helpful
          </span>
        ) : null}
      </div>
      {review.title !== undefined ? (
        <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
          <Star className="size-3.5 text-amber-500" />
          {review.title}
        </h3>
      ) : null}
      <p className="text-muted-foreground text-sm leading-relaxed">{review.body}</p>
    </article>
  );
}
