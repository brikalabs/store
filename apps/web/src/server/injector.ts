import { env } from "cloudflare:workers";
import { createInjector, type Injector } from "@brika/di";
import { Bindings } from "@/server/bindings";
import { BlobStore, CfR2BlobStore } from "@/server/blob-store";

/**
 * A fresh per-request injector for the web app. {@link Bindings} (the Cloudflare bindings for
 * this request) is the ONLY value the composition root hands in; everything else self-builds.
 * The store side auto-resolves from `Bindings`: `Database`/`RegistryDatabase` build their drizzle
 * client from `inject(Bindings).DB`, the `reg_*` graph (`Registry`) wires over `RegistryDatabase`,
 * and every store + `SocialService` auto-resolves (a concrete class is its own provider). The one
 * interface->impl binding is `BlobStore`: an abstract class has no constructor to auto-build, so
 * `inject(BlobStore)` is mapped to `CfR2BlobStore` here. A handler just `inject(...)` the class it
 * needs and the whole graph builds lazily in this scope.
 */
export function webInjector(): Injector {
  return createInjector([
    { provide: Bindings, useValue: env },
    { provide: BlobStore, useClass: CfR2BlobStore },
  ]);
}
