# @brika/registry-cli

The `brika` command-line tool for **publishing** Brika plugins to the registry
(`registry.brika.dev`).

Installing plugins needs no CLI: the registry speaks the npm protocol, so a hub
just adds `@brika:registry=https://registry.brika.dev` to its `.npmrc` and runs
`bun add @brika/<plugin>`. This CLI only covers the publish side, which uses
GitHub identity instead of npm accounts.

## Usage

```sh
brika login                # authorize this machine via the GitHub device flow
brika pack [dir]           # pack + write the tarball and print its contents
brika publish [dir]        # pack, validate, and publish (default: .)
brika publish --dry-run    # pack + validate without publishing
brika whoami               # show the current login
brika logout               # revoke the token on the registry and remove it locally
```

`brika login` prints a short code and a URL on `store.brika.dev`; approve it
there (signed in with GitHub) and the CLI stores a 90-day publish token in
`~/.config/brika/config.json` (owner-only, honoring `XDG_CONFIG_HOME`).
`brika logout` revokes that token on the registry and removes it locally.

`brika publish` builds the tarball in-process (no `npm`, no subprocess) and
computes the `sha512` integrity with the same code the registry uses, validates
the `package.json` against the published-plugin contract (`@brika/schema`: a valid plugin manifest
plus `icon`, `displayName`, and `description`), prints the tarball contents and
digests, then `POST`s it to `/-/publish` and checks that the integrity the
registry stored matches what was packed. Use `brika pack` or
`brika publish --dry-run` to inspect exactly what would be uploaded first. A
scope is claimed by its first publisher; later versions must come from the same
GitHub identity, and versions are immutable.

## Environment

| Variable          | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `BRIKA_REGISTRY`  | Override the registry URL (default `https://registry.brika.dev`). |
| `BRIKA_TOKEN`     | Use this publish token instead of the saved login (for CI).   |

In CI, GitHub Actions OIDC is used instead of a token (audience `brika-registry`).

## Built on @brika/cli-kit

Commands are defined with `@brika/cli-kit` (`defineCommand` / `createCli`), the
same framework the hub CLI uses, so the command syntax and `@clack/prompts` UX
match. The standalone `brika` bin and the hub share one command group:

```ts
import { createRegistryCli, registryCommands } from "@brika/registry-cli";

// Standalone (what the `brika` bin runs):
await createRegistryCli().run();

// Merge flat, so `brika publish` / `brika login` are top-level hub commands:
hub.addCommands(registryCommands);

// ...or namespace them as `brika registry publish`:
hub.addCommand(createRegistryCli().toCommand("registry", "Brika plugin registry"));
```

`addCommands` flat-merges a group from any package. A name that clashes with the
hub's (or another merged package's) fails fast with a **CLI build error** at
startup rather than silently overriding. Use the namespace form to keep names
isolated instead.

> `@brika/cli-kit` is currently vendored under `packages/cli-kit`; swap it for the
> published package once it ships.

