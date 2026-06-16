import {
  type AttestInput,
  getAttestationProvider,
  registerAttestationProvider,
  type TransparencyEntry,
} from "@brika/registry-core";
import { sigstoreProvider } from "./sigstore";

/**
 * Select and run the configured attestation provider. Sigstore is the default;
 * `BRIKA_ATTESTATION_PROVIDER` swaps it (`none` disables). Providers are
 * registered through `@brika/registry-core`'s registry, so adding another
 * backend is a `registerAttestationProvider` call, not a change here.
 */

registerAttestationProvider(sigstoreProvider);

const DEFAULT_PROVIDER = "sigstore";

/** The attestation provider id the CLI will use. */
export function attestationProviderId(env: NodeJS.ProcessEnv = process.env): string {
  return env.BRIKA_ATTESTATION_PROVIDER ?? DEFAULT_PROVIDER;
}

/**
 * Attest a packed tarball, returning a transparency entry to attach to the
 * publish, or null when attestation is disabled/unavailable (so publishing
 * proceeds unattested).
 */
export async function attestPackage(input: AttestInput): Promise<TransparencyEntry | null> {
  const id = attestationProviderId();
  if (id === "none") return null;
  const provider = getAttestationProvider(id);
  return provider === null ? null : provider.attest(input);
}
