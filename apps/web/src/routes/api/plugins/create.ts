import { inject } from "@brika/di";
import {
  isCanonicalName,
  ManagementService,
  ScopeService,
  trustedPublisherSchema,
} from "@brika/registry-core";
import { MetadataReader } from "@brika/registry-runtime";
import { okOrThrow, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readJsonBody, recordAudit, runAuthed } from "@/server/http";

const Body = z.object({
  scope: z.string().min(1),
  name: z.string().min(1),
  // Optional: authorize a CI repo now so the first publish works tokenlessly (OIDC).
  publisher: trustedPublisherSchema.optional(),
});

/**
 * `POST /api/plugins/create` - reserve a plugin name in one of your scopes. Creates the package
 * row with no version, so it is owned (publish-gated) and shows to its owner as "Reserved" but
 * stays out of the public store until the first publish. Same scope gate as publishing. When a
 * trusted publisher is included it is wired now (best-effort: the reservation stands either way,
 * so a publisher error is reported, not fatal).
 */
export const Route = createFileRoute("/api/plugins/create")({
  server: {
    handlers: {
      // Live name check for the create form: is `@scope/name` a valid, still-available name?
      GET: ({ request }) =>
        runAuthed(request, async () => {
          const url = new URL(request.url);
          const fullName = `${url.searchParams.get("scope") ?? ""}/${url.searchParams.get("name") ?? ""}`;
          if (!isCanonicalName(fullName)) return reply({ valid: false, available: false });
          const record = await inject(MetadataReader).getPackage(fullName);
          return reply({ valid: true, available: record === null });
        }),
      POST: ({ request }) =>
        runAuthed(request, async (a) => {
          const { scope, name, publisher } = await readJsonBody(
            request,
            Body,
            "api:invalidCreateRequest",
          );
          const fullName = `${scope}/${name}`;

          okOrThrow(await inject(ManagementService).reservePackage(a.identity, fullName));
          await recordAudit(a, { action: "reserve", packageName: fullName });

          let trustedPublisher = null;
          if (publisher) {
            const bound = await inject(ScopeService).addTrustedPublisher(
              a.identity,
              scope,
              publisher,
            );
            if (bound.ok) {
              trustedPublisher = bound.publisher;
              await recordAudit(a, {
                action: "scope_trusted_publisher_add",
                packageName: scope,
                detail: publisher,
              });
            }
          }
          return reply({ ok: true, name: fullName, trustedPublisher }, 201);
        }),
    },
  },
});
