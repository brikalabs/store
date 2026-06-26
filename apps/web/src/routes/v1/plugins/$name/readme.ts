import type { ReadmeResponse } from "@brika/registry-contract";
import { notFound, readQuery } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPluginPage } from "@/lib/registry/registry";
import { publicJson, runHandler } from "@/server/http";

const ReadmeQuery = z.object({ lang: z.string().optional() });

/** `GET /v1/plugins/:name/readme` */
export const Route = createFileRoute("/v1/plugins/$name/readme")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runHandler(async () => {
          const { lang } = readQuery(request, ReadmeQuery);
          const page = await getPluginPage(params.name, lang);
          if (page === null) throw notFound();
          const body: ReadmeResponse = { readme: page.readme, filename: "README.md" };
          return publicJson(body);
        }),
    },
  },
});
