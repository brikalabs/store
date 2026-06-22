import type { Jwk, JwksProvider } from "@brika/registry-core";
import { z } from "zod";

const Jwks = z.object({
  keys: z.array(z.object({ kid: z.string(), kty: z.string(), n: z.string(), e: z.string() })),
});

/** Fetches and caches a provider's OIDC signing keys from its JWKS endpoint (one per issuer URL). */
export class CachingJwksProvider implements JwksProvider {
  #cache: Jwk[] | null = null;
  #fetchedAt = 0;

  constructor(
    private readonly url: string,
    private readonly ttlMs = 60 * 60 * 1000,
  ) {}

  async keys(): Promise<Jwk[]> {
    const now = Date.now();
    if (this.#cache !== null && now - this.#fetchedAt < this.ttlMs) return this.#cache;
    const res = await fetch(this.url);
    if (!res.ok) return this.#cache ?? [];
    const parsed = Jwks.safeParse(await res.json());
    if (!parsed.success) return this.#cache ?? [];
    this.#cache = parsed.data.keys;
    this.#fetchedAt = now;
    return this.#cache;
  }
}
