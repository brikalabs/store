# Build attestation & transparency log

Published `@brika/*` tarballs can carry a **public transparency-log attestation**
(sigstore by default): a keyless signature bound to the GitHub Actions OIDC
identity and recorded in the public Rekor log. The store surfaces a
**Verify on sigstore** link in the plugin's *Integrity & provenance* section, so
anyone can independently confirm the published bytes were signed by the repo that
claims them.

The signing/log backend is **pluggable** — sigstore is one provider behind the
`AttestationProvider` port in `@brika/registry-core`.

## How it flows

```
CI publish (brika publish)                 registry (/-/publish)         store
──────────────────────────                 ─────────────────────         ─────
pack -> integrity (sha512)
attestPackage() ──► provider.attest()
  sigstore: Fulcio cert from OIDC
            + Rekor log entry
  ─► TransparencyEntry { provider,
        logUrl, logIndex, integrity }
publish({ ..., transparencyLog }) ───────► withAttestation():
                                             - publish is OIDC-authenticated
                                             - entry.integrity == sha512(bytes)
                                             ► store on version.provenance ──► "Verify on sigstore"
```

Trust model: the registry only attaches an attestation to a version when the
publish is **OIDC-authenticated** (a forge-proof identity) **and** the attested
integrity matches the bytes it received. The ultimate anchor is the **public**
Rekor entry the link points to — verifiable by anyone, independent of us.
Attestation is **best-effort**: a publish never fails because signing failed; it
just ships unattested.

## Enabling it in CI

Attestation runs only in GitHub Actions (it needs an OIDC token) and requires the
optional `sigstore` package (loaded dynamically; the CLI has no hard dependency
on it):

```yaml
permissions:
  id-token: write          # let the job mint OIDC tokens (Fulcio + the registry)
  contents: read
steps:
  - run: npm i -g sigstore  # or add to the publish image
  - run: brika publish ./my-plugin
    env:
      BRIKA_TOKEN: ${{ secrets.BRIKA_TOKEN }}   # or rely on OIDC trusted publishing
```

Outside CI, or without the `sigstore` package, `brika publish` simply skips
attestation. Set `BRIKA_ATTESTATION_PROVIDER=none` to disable it explicitly.

## Adding / swapping a provider

A provider implements `AttestationProvider` from `@brika/registry-core`:

```ts
import { type AttestationProvider, registerAttestationProvider } from "@brika/registry-core";

const myProvider: AttestationProvider = {
  id: "my-log",
  async attest({ integrity, subject }) {
    /* sign + record; return { provider: "my-log", logUrl, logIndex?, integrity } or null */
  },
  async verify(entry) {
    /* re-check the entry; false-safe */
  },
};
registerAttestationProvider(myProvider);
```

Select it with `BRIKA_ATTESTATION_PROVIDER=my-log`. Every stored entry records its
`provider`, so a future entry from a different backend stays self-describing and
the right verifier can be picked. The store renders any provider's `logUrl`
generically (the link reads "Verify on <provider>").
