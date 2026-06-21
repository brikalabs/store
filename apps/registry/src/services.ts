import {
  DeviceService,
  ManagementService,
  PublishService,
  ResolveService,
  ScopeService,
} from "@brika/registry-core";
import type { Db } from "@brika/store-db";
import {
  CloudflareDohResolver,
  D1AuditLog,
  D1CatalogReader,
  D1DeviceStore,
  D1DownloadStore,
  D1MetadataReader,
  D1MetadataWriter,
  D1OwnershipPolicy,
  D1ScopeDomains,
  D1ScopeMembers,
  D1ScopeStore,
  D1TokenStore,
  D1TrustedPublishers,
  HmacDomainChallenge,
  resolveDisplayName,
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
  domainSecret = "test-domain-secret",
) {
  // The D1 implementation of the scope membership port, built once and injected into the
  // authorization policy (which depends on the port, not the concrete adapter) and shared
  // with the scope controller. The scope IS the ownership entity (npm/JSR model), so
  // publishing resolves the package's scope straight to its membership (scopeMembers).
  const scopeMembers = new D1ScopeMembers(db);
  // Trusted-publisher bindings (PUB-016) authorize tokenless OIDC publishes; shared between
  // the publish authorization policy and the scope controller that manages the bindings.
  const trustedPublishers = new D1TrustedPublishers(db);
  const ownership = new D1OwnershipPolicy(scopeMembers, trustedPublishers);
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
    /**
     * Scope use cases (the scope IS the ownership entity): claim a scope, members + roles,
     * display name, profile (description, links, icon), and claim/verify domains (over the
     * stores). The claim gate (ORG-006) defaults to allow-all in `ScopeService` until a real
     * identity verifier lands; domain verification resolves TXT records over DNS-over-HTTPS
     * (ORG-010).
     */
    scopes: new ScopeService(new D1ScopeStore(db), scopeMembers, new D1ScopeDomains(db), {
      dnsResolver: new CloudflareDohResolver(),
      domainChallenge: new HmacDomainChallenge(domainSecret),
      trustedPublishers,
    }),
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
    /**
     * Resolve a human display name for an authenticated GitHub login, for the CLI's
     * `login`/`whoami` output. The account identity (`users`, `user_profiles`) lives in
     * the store web app's tables, which are NOT part of the registry's `reg_*` drizzle
     * schema but share the SAME bound D1 (`env.DB`); the resolver reads them with a single
     * parameterized raw query over that client. Returns null when no display name exists,
     * so the caller falls back to the github login.
     */
    resolveDisplayName: (githubLogin: string) => resolveDisplayName(db, githubLogin),
  } as const;
}

/**
 * The per-request service graph, inferred from {@link buildServices}. Handlers
 * depend on this type; adding a service to the factory extends it here for free.
 */
export type Services = ReturnType<typeof buildServices>;
