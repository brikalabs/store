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

`brika publish` packs the directory with `bun` (no `npm` binary required) and
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

## Embedding in another CLI

The commands are exported as a portable group, so the same code runs standalone
(`brika …`) and can be merged into the hub's `brika` CLI:

```ts
import { registryCommands, runCli } from "@brika/registry-cli";

// Run the group directly...
await runCli(registryCommands, process.argv.slice(2));
// ...or adapt each CommandSpec into the hub's own framework (e.g. under a
// `registry` namespace, so `brika registry publish` works).
```

Each command parses its own argv and throws `CliError` instead of calling
`process.exit`, so the host CLI owns the process lifecycle and output.

