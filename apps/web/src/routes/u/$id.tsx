import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserProfilePage } from "@/components/profile/user-profile-page";
import { resolveUserPage } from "@/lib/registry/user-page";

// A server function so the D1 reads (the social DB + the `reg_*` scope membership)
// always run on the server, even on a client-side navigation.
const fetchUserPage = createServerFn()
  .validator((id: string) => id)
  .handler(({ data: id }) => resolveUserPage(id));

export const Route = createFileRoute("/u/$id")({
  loader: ({ params }) => fetchUserPage({ data: params.id }),
  component: UserProfilePage,
});
