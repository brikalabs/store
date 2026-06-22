import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Resolve `node:async_hooks` to a no-op shim in the CLIENT (browser) build only. `@brika/di`'s
 * injector statically imports it for its server-only `AsyncLocalStorage` context; client code that
 * imports a token / pure helper from a domain package transitively pulls the injector in, and the
 * browser externalizes `node:` builtins (throwing on access). The SSR build keeps the real module.
 */
function browserAsyncHooksShim(): Plugin {
  const shim = fileURLToPath(new URL("./src/shims/async-hooks.ts", import.meta.url));
  return {
    name: "browser-async-hooks-shim",
    enforce: "pre", // run before vite's built-in node: externalization
    resolveId(id) {
      if (id === "node:async_hooks" && this.environment?.name === "client") return shim;
    },
  };
}

export default defineConfig({
  // `@/` -> src/, mirroring tsconfig `paths` so dev/build, tsgo, and bun test agree.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Pinned so the GitHub OAuth callback stays stable across dev runs and matches
  // the dev OAuth app + .dev.vars (http://localhost:3000/auth/github/callback).
  // The registry worker, when run, uses wrangler's default 8787.
  server: { port: 3000 },
  plugins: [
    browserAsyncHooksShim(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
});
