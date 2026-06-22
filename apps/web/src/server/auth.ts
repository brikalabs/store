import { inject, token } from "@brika/di";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Database } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { config } from "@/server/env";

/**
 * Build the store's BetterAuth instance (AUTH-010/012/013): D1-backed sessions via the Drizzle
 * adapter, GitHub as the first social provider. A functional DI factory - it `inject(...)`s its
 * deps, so it runs inside a `runWeb` context (it backs the {@link Auth} token).
 */
function buildAuth() {
  const { SESSION_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL } = config();
  return betterAuth({
    // The adapter resolves each BetterAuth model by key in `schema`: `user` -> `users` (see
    // `modelName`), `session`/`account`/`verification` -> the matching exports.
    database: drizzleAdapter(inject(Database), { provider: "sqlite", schema }),
    secret: SESSION_SECRET,
    baseURL: BETTER_AUTH_URL,
    trustedOrigins: [BETTER_AUTH_URL],
    socialProviders: {
      github: {
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        // Sync provider avatar/name onto the account; identity stays the Brika `users.id`.
        mapProfileToUser: (profile) => ({
          image: profile.avatar_url,
          name: profile.name ?? profile.login,
        }),
      },
    },
    // Cross-provider linking (AUTH-011): a trusted provider's verified email auto-links to an
    // existing account; `allowUnlinkingAll` defaults false, so the last sign-in method can't go.
    account: { accountLinking: { enabled: true, trustedProviders: ["github"] } },
    // Map the `user` model onto the existing `users` table (USER-001); the user-authored profile
    // columns on that table are written by the store directly, so they stay off this config.
    user: { modelName: "users" },
  });
}

type Auth = ReturnType<typeof buildAuth>;

/**
 * The BetterAuth instance as an isolate-singleton injectable (Angular `providedIn: 'root'` style):
 * it self-provides via {@link buildAuth}, so resolving `inject(Auth)` in any `runWeb` context builds
 * it once and caches it - no provider entry needed.
 */
export const Auth = token<Auth>("Auth", buildAuth);
