import type { Db } from "@/server/db/client";
import { serverContext } from "@/server/server-context";
import { SocialService } from "@/server/services/social-service";
import { CommentStore } from "@/server/stores/comment-store";
import { PluginStore } from "@/server/stores/plugin-store";
import { ReviewStore } from "@/server/stores/review-store";
import { UserProfileStore } from "@/server/stores/user-profile-store";
import { UserStore } from "@/server/stores/user-store";

/**
 * The social composition root: build the repositories over the store's D1 and the
 * {@link SocialService} that orchestrates them, once per request. Mirrors `registryServices()`
 * for the `reg_*` graph. SERVER-ONLY (the default `db` reads the `cloudflare:workers` binding
 * via {@link serverContext}), so reference it only from route `server` handlers / loaders; unit
 * tests construct `SocialService` with an in-memory db instead.
 */
export function socialService(db: Db = serverContext().db): SocialService {
  return new SocialService({
    users: new UserStore(db),
    profiles: new UserProfileStore(db),
    reviews: new ReviewStore(db),
    comments: new CommentStore(db),
    plugins: new PluginStore(db),
  });
}
