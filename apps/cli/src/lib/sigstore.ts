import type { AttestationProvider, AttestInput, TransparencyEntry } from "@brika/registry-core";

/**
 * The sigstore {@link AttestationProvider}: keyless signing (Fulcio) + a public
 * transparency-log entry (Rekor) for a published tarball, anchored on the CI
 * OIDC identity.
 *
 * `sigstore` is an OPTIONAL runtime dependency, loaded dynamically only when
 * attesting in CI. The specifier is held in a variable so TypeScript treats the
 * import as `any` and the CLI carries no hard dependency on sigstore's (heavy)
 * tree: install it in the publish workflow (`npm i sigstore`) to enable
 * attestation; without it, or outside CI, publishing degrades to an unattested
 * release rather than failing.
 */

const SIGSTORE_ID = "sigstore";
const REKOR_SEARCH = "https://search.sigstore.dev";
const REKOR_API = "https://rekor.sigstore.dev/api/v1/log/entries";
const PAYLOAD_TYPE = "application/vnd.brika.attestation+json";

/** True when running in GitHub Actions with an OIDC token available to mint. */
export function canAttestInCi(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ACTIONS_ID_TOKEN_REQUEST_URL && env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
}

/** Public, human-viewable Rekor entry URL for a log index. */
export function rekorSearchUrl(logIndex?: string): string {
  return logIndex
    ? `${REKOR_SEARCH}/?logIndex=${encodeURIComponent(logIndex)}`
    : `${REKOR_SEARCH}/`;
}

/** The minimal shape we read out of a serialized sigstore bundle. */
interface SerializedBundleLike {
  readonly verificationMaterial?: {
    readonly tlogEntries?: ReadonlyArray<{ readonly logIndex?: string }>;
  };
}

/** Build a provider-agnostic entry from a sigstore bundle (pure; unit-tested). */
export function entryFromBundle(
  bundle: SerializedBundleLike,
  integrity: string,
): TransparencyEntry {
  const logIndex = bundle.verificationMaterial?.tlogEntries?.[0]?.logIndex;
  return { provider: SIGSTORE_ID, logUrl: rekorSearchUrl(logIndex), logIndex, integrity };
}

/** Dynamically load the optional `sigstore` package, or null when absent. */
async function loadSigstore(): Promise<{
  attest(payload: Uint8Array, payloadType: string): Promise<SerializedBundleLike>;
} | null> {
  const specifier = SIGSTORE_ID;
  try {
    return await import(specifier);
  } catch {
    return null;
  }
}

export const sigstoreProvider: AttestationProvider = {
  id: SIGSTORE_ID,

  async attest(input: AttestInput): Promise<TransparencyEntry | null> {
    if (!canAttestInCi()) return null;
    const sigstore = await loadSigstore();
    if (sigstore === null) return null;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ subject: input.subject, integrity: input.integrity }),
      );
      const bundle = await sigstore.attest(payload, PAYLOAD_TYPE);
      return entryFromBundle(bundle, input.integrity);
    } catch {
      // Attestation is best-effort: never fail a publish because signing failed.
      return null;
    }
  },

  async verify(entry: TransparencyEntry): Promise<boolean> {
    // Reference-only model: confirm the entry still exists in the public Rekor
    // log. The integrity binding is independently checkable via `entry.logUrl`.
    if (entry.provider !== SIGSTORE_ID || entry.logIndex === undefined) return false;
    try {
      const res = await fetch(`${REKOR_API}?logIndex=${encodeURIComponent(entry.logIndex)}`, {
        headers: { accept: "application/json" },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
