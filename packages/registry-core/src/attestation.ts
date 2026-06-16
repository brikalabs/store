import { z } from "zod";

/**
 * Build-attestation abstraction: signing an artifact and recording it in a public
 * transparency log, behind a provider port so the backend (sigstore today) can be
 * swapped without touching the publish/resolve flow.
 *
 * The flow is split by where the trust material lives:
 *   - **attest** runs in CI (the publisher holds the OIDC identity), producing a
 *     provider-agnostic {@link TransparencyEntry} that the CLI sends with the
 *     publish. The registry stores it on the version and surfaces the public log
 *     link. registry-core owns only the shape + the provider registry; the
 *     concrete sigstore adapter (network, OIDC, the `sigstore` package) lives in
 *     the client where it runs.
 *   - **verify** re-checks an entry against an artifact; best-effort, so a
 *     provider that cannot verify returns false rather than throwing.
 */

/** A transparency-log reference for a published artifact (provider-agnostic). */
export const TransparencyEntry = z.object({
  /** Provider that produced the entry, e.g. `"sigstore"`. Selects the verifier. */
  provider: z.string(),
  /** Public, human-viewable URL of the log entry (the trust anchor). */
  logUrl: z.url(),
  /** Provider-specific log index / UUID, when the provider exposes one. */
  logIndex: z.string().optional(),
  /** The artifact Subresource Integrity (`sha512-...`) this entry attests. */
  integrity: z.string(),
});
export type TransparencyEntry = z.infer<typeof TransparencyEntry>;

export interface AttestInput {
  /** Subresource Integrity of the tarball being attested (`sha512-...`). */
  readonly integrity: string;
  /** Human subject of the attestation, e.g. `@brika/plugin-x@1.2.3`. */
  readonly subject: string;
}

/** A pluggable signing + transparency-log backend. */
export interface AttestationProvider {
  /** Stable id recorded on every entry, e.g. `"sigstore"`. */
  readonly id: string;
  /**
   * Create an attestation using the ambient CI identity. Returns null when the
   * environment cannot attest (e.g. not running in CI / no OIDC), so publishing
   * degrades gracefully to an unattested release.
   */
  attest(input: AttestInput): Promise<TransparencyEntry | null>;
  /** Re-verify an entry against the artifact integrity. False-safe on failure. */
  verify(entry: TransparencyEntry): Promise<boolean>;
}

const providers = new Map<string, AttestationProvider>();

/** Register a provider so it can be selected by id (last registration wins). */
export function registerAttestationProvider(provider: AttestationProvider): void {
  providers.set(provider.id, provider);
}

/** The provider registered under `id`, or null when none is. */
export function getAttestationProvider(id: string): AttestationProvider | null {
  return providers.get(id) ?? null;
}

/** All registered provider ids (for diagnostics / configuration validation). */
export function attestationProviderIds(): string[] {
  return [...providers.keys()];
}

/** Test/reset hook: clear the registry. */
export function clearAttestationProviders(): void {
  providers.clear();
}

/**
 * A provider that never attests and never verifies. Useful as an explicit
 * "attestation disabled" selection and as a safe default in non-CI contexts.
 */
export const nullAttestationProvider: AttestationProvider = {
  id: "none",
  attest: () => Promise.resolve(null),
  verify: () => Promise.resolve(false),
};
