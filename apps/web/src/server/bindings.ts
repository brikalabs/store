/**
 * The Cloudflare request bindings, as an abstract class so it is both the interface and the
 * DI token. The ONE thing the composition root provides (`useValue` over the live `env`);
 * everything else self-builds from it (a store reads `inject(Bindings).DB`, the blob store reads
 * `inject(Bindings).ASSETS`). `Cloudflare.Env` structurally satisfies this (its extra bindings,
 * e.g. the unwired `CACHE`, are ignored), so `{ provide: Bindings, useValue: env }` typechecks.
 */
export abstract class Bindings {
  /** The shared `brika-store` D1 database (store/social tables AND the `reg_*` registry tables). */
  abstract readonly DB: D1Database;
  /** The R2 bucket for mirrored tarball assets, the file index, and scope icons. */
  abstract readonly ASSETS: R2Bucket;
}
