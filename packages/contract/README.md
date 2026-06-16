# @brika/registry-contract

The Brika `/v1` registry contract: Zod schemas and types for the HTTP API a
plugin registry exposes to a hub. Any service that implements the mandatory
discovery core can act as a registry; optional social capabilities (profiles,
reviews, comments) are advertised through `GET /v1/registry` so a consumer knows
what a given registry supports.

**Metadata only by design.** npm remains the source of truth for code; a registry
never serves plugin code, only the metadata around it.

## What it defines

- `CONTRACT_VERSION` and `RegistryCapabilities` (`GET /v1/registry`): the feature
  flags (`RegistryFeature`) a registry advertises, plus optional `SigningInfo`
  (an Ed25519 key a consumer can pin to trust the verified list).
- The discovery core: search, plugins, versions, readme, icon, verified.
- Social: profiles, reviews, comments.
- `ResolvedUrl`: an asset URL that is either absolute (`http(s)`, e.g. a CDN link)
  or root-relative (served by the registry origin), so both plugin hosting models
  fit one shape.

## Usage

Producers (the registry) parse outgoing payloads against these schemas; consumers
(the hub, the storefront) infer their types from the same package, so the two
sides cannot drift:

```ts
import { RegistryCapabilities } from "@brika/registry-contract";

const caps = RegistryCapabilities.parse(await res.json());
if (caps.features.includes("reviews")) { /* ... */ }
```

## Tests

```sh
bun test
```
