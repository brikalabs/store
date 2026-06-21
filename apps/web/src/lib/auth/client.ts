import { createAuthClient } from "better-auth/react";

/**
 * Browser-side BetterAuth client (AUTH-011 / USER-004). It targets the same
 * handler the server mounts at `/api/auth/*` (see `routes/api/auth/$.ts`), so the
 * console can drive the linking surface - `listAccounts`, `linkSocial`,
 * `unlinkAccount` - directly against the live auth endpoints.
 *
 * `createAuthClient` validates `baseURL` as an ABSOLUTE url at construction (which
 * also runs during SSR), so a relative `/api/auth` throws. The client only issues
 * real requests in the browser, so: use `VITE_BETTER_AUTH_URL` when set, else the
 * live `window.location.origin` (browser), else a valid SSR placeholder that is
 * never actually called. Mirrors how the registry facade reads `VITE_REGISTRY_URL`.
 */
const ORIGIN = (import.meta.env?.VITE_BETTER_AUTH_URL as string | undefined)?.replace(/\/+$/, "");

function authBaseUrl(): string {
  if (ORIGIN !== undefined) return `${ORIGIN}/api/auth`;
  if (globalThis.window !== undefined) return `${globalThis.location.origin}/api/auth`;
  return "http://localhost/api/auth";
}

export const authClient = createAuthClient({ baseURL: authBaseUrl() });

export const { listAccounts, linkSocial, unlinkAccount } = authClient;
