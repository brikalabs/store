import { getRouteApi } from "@tanstack/react-router";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { NotFoundPage } from "@/components/feedback/error-pages";
import { ProfileLinks } from "@/components/plugin/profile-links";
import { PublishedPlugins } from "@/components/plugin/published-plugins";
import { Stat } from "@/components/plugin/showcase-card";
import { ReviewRow } from "@/components/profile/review-row";
import { formatCount } from "@/lib/format";
import type { UserPage } from "@/lib/registry/user-page";

const route = getRouteApi("/u/$id");

export function UserProfilePage() {
  const data = route.useLoaderData();
  if (data === null) return <NotFoundPage />;
  return <UserProfileView page={data} />;
}

function UserProfileView({ page }: Readonly<{ page: UserPage }>) {
  const { profile, plugins, reviews } = page;
  const name = profile.displayName;
  const weekly = plugins.reduce((sum, plugin) => sum + plugin.downloadsWeekly, 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <GradientAvatar
          seed={profile.id}
          label={name}
          imageUrl={profile.avatarUrl}
          size={84}
          className="rounded-[20px]"
        />
        <div className="flex-1">
          <h1 className="font-bold font-heading text-3xl tracking-tight">{name}</h1>
          {profile.bio !== undefined && profile.bio.length > 0 ? (
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">{profile.bio}</p>
          ) : null}
          <ProfileLinks
            links={[
              ...(profile.website === undefined
                ? []
                : [{ label: "Website", url: profile.website }]),
              ...profile.links,
            ]}
          />
        </div>
        <div className="flex gap-2.5">
          <Stat value={String(plugins.length)} label="plugins" />
          {reviews.length > 0 ? <Stat value={String(reviews.length)} label="reviews" /> : null}
          {weekly > 0 ? <Stat value={formatCount(weekly)} label="installs / week" /> : null}
        </div>
      </header>

      <div className="h-px bg-border" />

      <PublishedPlugins plugins={plugins} />

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
