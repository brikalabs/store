import { CONTRACT_VERSION, RegistryCapabilities } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";

/** `GET /v1/registry`: the capabilities manifest consumers read to learn which contract features this registry supports. */
const CAPABILITIES = RegistryCapabilities.parse({
  name: "Brika Official Store",
  contractVersion: CONTRACT_VERSION,
  features: [
    "search",
    "plugins",
    "versions",
    "readme",
    "icon",
    "verified",
    "profiles",
    "reviews",
    "comments",
  ],
});

export const Route = createFileRoute("/v1/registry")({
  server: {
    handlers: {
      GET: () =>
        Response.json(CAPABILITIES, {
          headers: { "cache-control": "public, max-age=300" },
        }),
    },
  },
});
