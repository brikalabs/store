import { modules } from "@brika/archunit";

/** Module categories shared across the architecture rules (the layers we keep apart). */
export const PLATFORM = modules("cloudflare:", "@cloudflare/", "wrangler");
export const ORM = modules("drizzle-orm", "@brika/store-db");
export const HTTP = modules("hono", "@brika/router");
