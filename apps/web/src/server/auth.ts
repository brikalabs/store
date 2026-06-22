import { inject, token } from "@brika/di";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Database } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { config } from "@/server/env";

/** Build the store's BetterAuth instance (AUTH-010/012/013): D1-backed sessions, GitHub social provider. */
function buildAuth() {
  const { SESSION_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL } = config();
  return betterAuth({
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
    // Map the `user` model onto the existing `users` table (USER-001).
    user: { modelName: "users" },
  });
}

type Auth = ReturnType<typeof buildAuth>;

/** The BetterAuth instance as an isolate-singleton injectable (self-provides via {@link buildAuth}). */
export const Auth = token<Auth>("Auth", buildAuth);
