import { env } from "cloudflare:workers";
import { createInjector, type Injector } from "@brika/di";
import { ENV } from "@/server/tokens";

/**
 * A fresh per-request injector for the web app. ENV is the ONLY thing declared here - the
 * Cloudflare bindings for this request. Everything else self-wires: DB and ASSETS resolve from
 * ENV via their token default factories, and every store + {@link SocialService} auto-resolves
 * (a concrete class is its own provider). So a handler just `inject(SocialService)` and the whole
 * graph is built lazily in this scope.
 */
export function webInjector(): Injector {
  return createInjector([{ provide: ENV, useValue: env }]);
}
