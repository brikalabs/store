import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Pinned so the GitHub OAuth callback stays stable across dev runs and matches
  // the dev OAuth app + .dev.vars (http://localhost:3000/auth/github/callback).
  // The registry worker, when run, uses wrangler's default 8787.
  server: { port: 3000 },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
});
