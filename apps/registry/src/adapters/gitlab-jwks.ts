import type { Jwk, JwksProvider } from "@brika/registry-core";
import { z } from "zod";

const JWKS_URL = "https://gitlab.com/oauth/discovery/keys";
const TTL_MS = 60 * 60 * 1000;

const Jwks = z.object({
  keys: z.array(z.object({ kid: z.string(), kty: z.string(), n: z.string(), e: z.string() })),
});

/** Fetches and caches GitLab.com's OIDC signing keys (the GitLab analog of {@link GithubJwksProvider}). */
export class GitlabJwksProvider implements JwksProvider {
  #cache: Jwk[] | null = null;
  #fetchedAt = 0;

  async keys(): Promise<Jwk[]> {
    const now = Date.now();
    if (this.#cache !== null && now - this.#fetchedAt < TTL_MS) return this.#cache;
    const res = await fetch(JWKS_URL);
    if (!res.ok) return this.#cache ?? [];
    const parsed = Jwks.safeParse(await res.json());
    if (!parsed.success) return this.#cache ?? [];
    this.#cache = parsed.data.keys;
    this.#fetchedAt = now;
    return this.#cache;
  }
}
