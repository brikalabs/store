import { VerifiedList } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { publicJson } from "@/server/http";

/**
 * `GET /v1/verified`: the signed curation list. Empty until the curation data
 * and the Ed25519 signing key are provisioned; the shape is already contract-stable.
 */
const VERIFIED = VerifiedList.parse({ plugins: [] });

export const Route = createFileRoute("/v1/verified")({
  server: {
    handlers: {
      GET: () => publicJson(VERIFIED),
    },
  },
});
