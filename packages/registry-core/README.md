# @brika/registry-core

The Brika registry's domain core. **No Cloudflare imports**: storage is behind
ports, so the same code runs under Bun (tests) and workerd (production), and the
security-critical logic is unit-testable in isolation. The services are
**field-injected** (`@brika/di`): each `inject()`s its ports, so the core stays
infrastructure-free while an app gets `inject(ResolveService)` DX.

## Modules

- **`integrity`** , `sha512Integrity(bytes)` (SRI) and `sha1Hex(bytes)`, the
  digests returned in the packument and pinned by bun.
- **`packument`** , `buildPackument(record, baseUrl)` produces an npm-compatible
  packument (hides yanked, surfaces deprecated, sets `dist.{tarball,integrity}`);
  plus `unscopedName` / `tarballPath` / `tarballUrl`.
- **`resolve`** , `ResolveService.packument(name)` and `.tarball(name, version)`.
- **`publish`** , `PublishService.publish(input)`: ownership gate -> data gate ->
  immutability -> integrity -> write tarball then metadata. Rejected publishes
  never write.
- **`oidc`** , `verifyGithubOidc(token, jwks, { audience })`: RS256 JWT
  verification against GitHub's JWKS; validates issuer/audience/expiry and returns
  the `repository` / `repository_owner` claims.
- **`types`** , `PackageVersion` (zod) and `PackageRecord`.

## Ports (implemented by the registry app)

| Port | Used by | Cloudflare adapter |
| --- | --- | --- |
| `MetadataReader` | resolve | D1 |
| `TarballReader` | resolve | R2 |
| `MetadataWriter` | publish | D1 |
| `TarballWriter` | publish | R2 |
| `ManifestValidator` | publish data gate | `@brika/schema` verify-checks |
| `OwnershipPolicy` | publish identity gate | D1 scopes + the OIDC claims |

## Example

`ResolveService` field-injects its ports; bind them (in an app's composition root, or a `testBed`)
and inject it. See [`docs/di.md`](../../docs/di.md) for the wiring rules.

```ts
import { testBed, provide } from "@brika/di";
import { MetadataReader, TarballReader, RegistryBaseUrl, ResolveService } from "@brika/registry-core";

const service = testBed(
  provide(MetadataReader, metadataReader),
  provide(TarballReader, tarballReader),
  provide(RegistryBaseUrl, new URL(request.url).origin),
).inject(ResolveService);
const packument = await service.packument("@brika/plugin-weather");
```

## Tests

```sh
bun test            # integrity, packument, resolve, publish, oidc
```
