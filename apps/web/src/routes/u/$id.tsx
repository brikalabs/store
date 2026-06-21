import { runInContext } from "@brika/di";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserProfilePage } from "@/components/profile/user-profile-page";
import { webProviders } from "@/server/injector";
import { resolveUserPage } from "@/server/services/user-page";

// A server function so the D1 reads (the social DB + the `reg_*` scope membership)
// always run on the server, even on a client-side navigation. The handler runs in a
// per-request injection context so `resolveUserPage` can `inject(SocialService)`.
const fetchUserPage = createServerFn()
  .validator((id: string) => id)
  .handler(({ data: id }) => runInContext(webProviders, () => resolveUserPage(id)));

export const Route = createFileRoute("/u/$id")({
  loader: ({ params }) => fetchUserPage({ data: params.id }),
  component: UserProfilePage,
});
