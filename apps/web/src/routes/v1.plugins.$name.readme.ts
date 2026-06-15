import type { ReadmeResponse } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { jsonNotFound, jsonOk } from "../lib/http";
import { getPluginPage } from "../lib/registry";

/** `GET /v1/plugins/:name/readme` */
export const Route = createFileRoute("/v1/plugins/$name/readme")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const lang = new URL(request.url).searchParams.get("lang") ?? undefined;
        const page = await getPluginPage(params.name, lang);
        if (page === null) return jsonNotFound();
        const body: ReadmeResponse = { readme: page.readme, filename: "README.md" };
        return jsonOk(body);
      },
    },
  },
});
