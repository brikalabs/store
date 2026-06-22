import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserProfilePage } from "@/components/profile/user-profile-page";
import { resolveUserPage } from "@/server/services/user-page";

// Server function so D1 reads run server-side (even on client navigation) inside the
// request injection context, so `resolveUserPage` can `inject(SocialService)`.
const fetchUserPage = createServerFn()
  .validator((id: string) => id)
  .handler(({ data: id }) => resolveUserPage(id));

export const Route = createFileRoute("/u/$id")({
  loader: ({ params }) => fetchUserPage({ data: params.id }),
  component: UserProfilePage,
});
