/// <reference types="@cloudflare/workers-types" />

// Bindings for `import { env } from "cloudflare:workers"`, from wrangler.jsonc.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TARBALLS: R2Bucket;
  }
}
