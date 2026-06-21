import { createAuthClient } from "better-auth/react";

/**
 * Browser-side BetterAuth client (AUTH-011 / USER-004). It targets the same
 * handler the server mounts at `/api/auth/*` (see `routes/api/auth/$.ts`), so the
 * console can drive the linking surface - `listAccounts`, `linkSocial`,
 * `unlinkAccount` - directly against the live auth endpoints.
 *
 * The base URL is a build-time constant: by default we use a relative `/api/auth`
 * (same origin as the console), and `VITE_BETTER_AUTH_URL` overrides the origin
 * for setups that serve the auth handler elsewhere. This mirrors how the registry
 * facade reads `VITE_REGISTRY_URL` (Vite inlines the value), keeping the module
 * import-safe on both the SSR worker and during client navigation.
 */
const ORIGIN = (import.meta.env?.VITE_BETTER_AUTH_URL as string | undefined)?.replace(/\/+$/, "");

export const authClient = createAuthClient({
  baseURL: ORIGIN === undefined ? "/api/auth" : `${ORIGIN}/api/auth`,
});

export const { listAccounts, linkSocial, unlinkAccount } = authClient;
