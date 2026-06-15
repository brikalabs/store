# @brika/registry-core

The Brika registry's domain core. **No Cloudflare imports**: storage is behind
ports, so the same code runs under Bun (tests) and workerd (production), and the
security-critical logic is unit-testable in isolation.

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

```ts
import { ResolveService } from "@brika/registry-core";

const service = new ResolveService(metadataReader, tarballReader, {
  baseUrl: new URL(request.url).origin,
});
const packument = await service.packument("@brika/plugin-weather");
```

## Tests

```sh
bun test            # integrity, packument, resolve, publish, oidc
```
