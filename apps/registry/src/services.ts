import {
  DeviceService,
  ManagementService,
  PublishService,
  ResolveService,
} from "@brika/registry-core";
import type { Db } from "@brika/store-db";
import { D1AuditLog } from "./adapters/d1-audit";
import { D1DeviceStore } from "./adapters/d1-device";
import { D1DownloadStore } from "./adapters/d1-downloads";
import { D1MetadataReader } from "./adapters/d1-metadata";
import { D1MetadataWriter } from "./adapters/d1-metadata-writer";
import { D1OwnershipPolicy } from "./adapters/d1-ownership";
import { SchemaManifestValidator } from "./adapters/manifest-validator";
import { R2TarballReader } from "./adapters/r2-tarball";
import { R2TarballWriter } from "./adapters/r2-tarball-writer";

/**
 * The registry's composition root: the one place that reads the Cloudflare
 * bindings and assembles the domain services with their concrete adapters. It is
 * built once per request and handed to handlers, so no handler reaches for the
 * ambient `env` itself.
 *
 * Adding a service is a single entry in the returned object below: its type flows
 * into {@link Services} and into every handler automatically, with no separate
 * interface to keep in sync. Swapping a backend means editing only this file and
 * the adapters it names; a test stands one in by passing an object of the same
 * shape (the inferred `Services`).
 *
 * Note: rate limiting is intentionally NOT here. It is a cross-cutting edge concern
 * declared inline on the routes that opt in (`rateLimit(...)` in the controllers,
 * backed by `adapters/cf-rate-limiter.ts`), so it never threads through this graph.
 */
export function buildServices(db: Db, tarballs: R2Bucket, baseUrl: string) {
  return {
    /** Drizzle client over the registry's D1 database (`reg_*` tables). */
    db,
    /** npm-protocol read surface: packuments + tarball streams. */
    resolve: new ResolveService(new D1MetadataReader(db), new R2TarballReader(tarballs), {
      baseUrl,
    }),
    /** Publish pipeline: ownership, validation, immutability, integrity. */
    publish: new PublishService(
      new D1MetadataWriter(db),
      new R2TarballWriter(tarballs),
      new SchemaManifestValidator(),
      new D1OwnershipPolicy(db),
    ),
    /** Post-publish management: deprecate, yank. */
    management: new ManagementService(new D1MetadataWriter(db), new D1OwnershipPolicy(db)),
    /** Per-day install-count store: record + stats. */
    downloads: new D1DownloadStore(db),
    /** Device-authorization flow (RFC 8628). */
    devices: new DeviceService(new D1DeviceStore(db)),
    /** Append-only audit log of publishes + management actions. */
    audit: new D1AuditLog(db),
  } as const;
}

/**
 * The per-request service graph, inferred from {@link buildServices}. Handlers
 * depend on this type; adding a service to the factory extends it here for free.
 */
export type Services = ReturnType<typeof buildServices>;
