import {
  DeviceService,
  ManagementService,
  PublishService,
  ResolveService,
  ScopeService,
} from "@brika/registry-core";
import type { Db } from "@brika/store-db";
import {
  D1AuditLog,
  D1CatalogReader,
  D1DeviceStore,
  D1DownloadStore,
  D1MetadataReader,
  D1MetadataWriter,
  D1OwnershipPolicy,
  D1ScopeMembers,
  D1ScopeStore,
  D1TokenStore,
} from "@brika/store-db/adapters";
import { SchemaManifestValidator } from "./adapters/manifest-validator";
import { NoopTarballScanner } from "./adapters/noop-tarball-scanner";
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
export function buildServices(
  db: Db,
  tarballs: R2Bucket,
  baseUrl: string,
  admins: ReadonlySet<string> = new Set(),
) {
  // The D1 implementation of the ScopeMembers port, built once and injected into the
  // authorization policy (which depends on the port, not this concrete adapter) and
  // shared with the scope controller for member management.
  const scopeMembers = new D1ScopeMembers(db);
  const ownership = new D1OwnershipPolicy(db, scopeMembers);
  // The raw drizzle client (`db`) is deliberately NOT exposed on the returned graph:
  // every persistence + auth concern goes through a port below, so a controller cannot
  // reach the database directly. Adapters capture `db` here at construction.
  return {
    /**
     * Operator admins (provider-qualified `provider:owner` keys) for takedown/restore,
     * resolved once here from `REGISTRY_ADMINS` rather than re-read from the ambient env
     * per request. Defaults to empty (no admins) so a test or a missing config fails
     * closed.
     */
    admins,
    /** npm-protocol read surface: packuments + tarball streams. */
    resolve: new ResolveService(new D1MetadataReader(db), new R2TarballReader(tarballs), {
      baseUrl,
    }),
    /** Publish pipeline: ownership, validation, immutability, integrity. */
    publish: new PublishService(
      new D1MetadataWriter(db),
      new R2TarballWriter(tarballs),
      new SchemaManifestValidator(),
      ownership,
      // Allow-all today; the seam for a real malware/abuse scanner over the bytes.
      { scanner: new NoopTarballScanner() },
    ),
    /** Post-publish management: deprecate, yank. */
    management: new ManagementService(new D1MetadataWriter(db), ownership),
    /** Scope use cases: create/claim, members + roles, display name (over the stores). */
    scopes: new ScopeService(new D1ScopeStore(db), scopeMembers),
    /** Package catalog read surface (`GET /-/v1/packages`). */
    catalog: new D1CatalogReader(db),
    /** Publish-token store (issue/verify/revoke) for auth + the device flow. */
    tokens: new D1TokenStore(db),
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
