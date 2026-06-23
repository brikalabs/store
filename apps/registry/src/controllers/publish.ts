import { inject } from "@brika/di";
import {
  isTrustedLogEntry,
  type PublishErrorCode,
  type PublishIdentity,
  PublishService,
  sha512Integrity,
  TransparencyEntry,
} from "@brika/registry-core";
import { httpError, rateLimit, reply } from "@brika/router";
import { transaction } from "@brika/tx";
import { z } from "zod";
import { cf } from "../adapters/cf-rate-limiter";
import { principal, requireWrite } from "../auth";
import { controller, route } from "../http/router";
import { Audit } from "../services";

/**
 * `POST /-/publish`. Authenticated by EITHER a CI OIDC token OR a registry publish token.
 * All publish logic + invariants live in `PublishService`; this is the wiring.
 */

const PublishBody = z.object({
  name: z.string(),
  version: z.string(),
  manifest: z.record(z.string(), z.unknown()),
  tarball: z.string(),
  /** Optional sigstore/transparency-log entry created by the CLI in CI. */
  transparencyLog: TransparencyEntry.optional(),
});

/**
 * Attach the client-provided transparency entry to provenance only when trustworthy: the publish is
 * OIDC-authenticated, the attested integrity matches the received bytes, AND the entry names a known
 * provider with a logUrl on that provider's real log host (so a forged entry cannot dress an
 * arbitrary URL up as a verified ledger link). Otherwise dropped, never blocking the publish.
 */
async function withAttestation(
  identity: PublishIdentity,
  tarball: Uint8Array,
  entry: TransparencyEntry | undefined,
): Promise<PublishIdentity> {
  if (entry === undefined || identity.provenance === undefined || !isTrustedLogEntry(entry)) {
    return identity;
  }
  const integrity = await sha512Integrity(tarball);
  if (entry.integrity !== integrity) return identity;
  return { ...identity, provenance: { ...identity.provenance, transparencyLog: entry } };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.codePointAt(i) ?? 0;
  return bytes;
}

function statusForPublishError(code: PublishErrorCode): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "exists":
      return 409;
    case "too_large":
      return 413;
    case "rejected":
      // Well-formed bytes refused by the malware/abuse scan: unprocessable, not malformed.
      return 422;
    default:
      return 400;
  }
}

export async function publish({
  body,
  req,
}: {
  readonly body: z.infer<typeof PublishBody>;
  readonly req: Request;
}): Promise<Response> {
  const publishService = inject(PublishService);
  const audit = inject(Audit);
  const identity = await requireWrite(req);

  const { name, version, manifest, tarball, transparencyLog } = body;
  const tarballBytes = base64ToBytes(tarball);
  const publisher = await withAttestation(identity, tarballBytes, transparencyLog);

  // In a transaction so a failed metadata commit rolls the staged tarball back: all-or-nothing across R2 + D1.
  const result = await transaction(() =>
    publishService.publish({
      name,
      version,
      tarball: tarballBytes,
      manifest,
      identity: publisher,
    }),
  );

  await audit.record({
    action: result.ok ? "publish" : "publish_rejected",
    packageName: name,
    version,
    actor: identity,
    detail: result.ok ? null : { code: result.code, message: result.message },
  });

  if (!result.ok) throw httpError(statusForPublishError(result.code), result.message, result.code);
  return reply({ ok: true, name, version, integrity: result.integrity }, 201);
}

export const publishController = controller({
  name: "publish",
  routes: [
    // Keyed by principal, not IP (see `principal`): CI shares runner egress IPs.
    route.post({
      path: "/-/publish",
      body: PublishBody,
      middleware: [
        rateLimit({ max: 100, window: "1m", key: principal, store: cf("PUBLISH_LIMITER") }),
      ],
      handler: publish,
    }),
  ],
});
