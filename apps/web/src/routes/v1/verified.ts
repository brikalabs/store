import { VerifiedList } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { publicJson } from "@/server/http";

/** `GET /v1/verified`: the signed curation list. Empty until curation data + signing key are provisioned. */
const VERIFIED = VerifiedList.parse({ plugins: [] });

export const Route = createFileRoute("/v1/verified")({
  server: {
    handlers: {
      GET: () => publicJson(VERIFIED),
    },
  },
});
