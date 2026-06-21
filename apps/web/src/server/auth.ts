import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { vars } from "@/server/env";

/**
 * The store's BetterAuth instance (AUTH-010/012/013). DB-backed sessions in D1 via
 * the Drizzle adapter; GitHub is the first social provider. This replaces the
 * hand-rolled GitHub OAuth + stateless signed-cookie session.
 *
 * Memoized per isolate: building the instance is cheap but `getSession`/`handler`
 * are called on every request, so we keep one instance per Worker isolate. The D1
 * binding (`env.DB`) is stable for the isolate, so this is safe.
 */
let cached: ReturnType<typeof build> | undefined;

function build() {
  const { SESSION_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, BETTER_AUTH_URL } = vars();

  return betterAuth({
    // DB-backed sessions/accounts/users/verification in D1 (AUTH-012/013). The
    // adapter looks up each BetterAuth model by name as a KEY in this schema
    // object: `user` -> `users` (via `modelName` below), and `session`/`account`/
    // `verification` -> the matching exports. Column property keys match
    // BetterAuth's field names; SQL column names stay snake_case.
    database: drizzleAdapter(getDb(env.DB), { provider: "sqlite", schema }),
    // Worker secret feeding session signing + CSRF (AUTH-013-AC1).
    secret: SESSION_SECRET,
    // Console origin: base URL for callbacks + the CSRF trusted origin (AUTH-013-AC3).
    baseURL: BETTER_AUTH_URL,
    trustedOrigins: [BETTER_AUTH_URL],
    socialProviders: {
      github: {
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        // Capture the GitHub username into the store-owned `login` field, which
        // scope ownership and the `github:<login>` operator allowlist depend on.
        // `image`/`name` keep `SessionUser.avatarUrl`/`name` resolving.
        mapProfileToUser: (profile) => ({
          login: profile.login,
          image: profile.avatar_url,
          name: profile.name ?? profile.login,
        }),
      },
    },
    user: {
      // Map BetterAuth's `user` model to the existing `users` table so `users.id`
      // stays the PK that reviews/comments/votes/reports reference (USER-001).
      modelName: "users",
      additionalFields: {
        // The GitHub username. Not required at the type level because BetterAuth
        // creates the row before `mapProfileToUser` is merged in some flows; it is
        // always populated for GitHub sign-in.
        login: { type: "string", required: false, input: false },
      },
    },
  });
}

export function getAuth(): ReturnType<typeof build> {
  cached ??= build();
  return cached;
}
