/// <reference types="@cloudflare/workers-types" />

// Augment `Cloudflare.Env`, the type of `env` from "cloudflare:workers".
// Bindings come from wrangler.jsonc; secrets are set with `wrangler secret put`
// (or .dev.vars locally). Committed so typecheck does not depend on `wrangler types`.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CACHE: KVNamespace;
    ASSETS: R2Bucket;
    SESSION_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    GITHUB_REDIRECT_URI: string;
  }
}
