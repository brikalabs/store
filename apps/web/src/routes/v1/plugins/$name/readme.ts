import type { ReadmeResponse } from "@brika/registry-contract";
import { notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getPluginPage } from "@/lib/registry/registry";
import { publicJson, runHandler } from "@/server/http";

/** `GET /v1/plugins/:name/readme` */
export const Route = createFileRoute("/v1/plugins/$name/readme")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runHandler(async () => {
          const lang = new URL(request.url).searchParams.get("lang") ?? undefined;
          const page = await getPluginPage(params.name, lang);
          if (page === null) throw notFound();
          const body: ReadmeResponse = { readme: page.readme, filename: "README.md" };
          return publicJson(body);
        }),
    },
  },
});
