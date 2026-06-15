# @brika/cli

The `brika` command-line tool for **publishing** Brika plugins to the registry
(`registry.brika.dev`).

Installing plugins needs no CLI: the registry speaks the npm protocol, so a hub
just adds `@brika:registry=https://registry.brika.dev` to its `.npmrc` and runs
`bun add @brika/<plugin>`. This CLI only covers the publish side, which uses
GitHub identity instead of npm accounts.

## Usage

```sh
brika login            # authorize this machine via the GitHub device flow
brika publish [dir]    # pack + publish the plugin in [dir] (default: .)
brika whoami           # show the current login
brika logout           # remove the saved token
```

`brika login` prints a short code and a URL on `store.brika.dev`; approve it
there (signed in with GitHub) and the CLI stores a 90-day publish token in
`~/.brika/config.json` (owner-only).

`brika publish` packs the directory with `npm pack`, validates the `package.json`
against the published-plugin contract (`@brika/schema`: a valid plugin manifest
plus `icon`, `displayName`, and `description`), then `POST`s it to `/-/publish`.
A scope is claimed by its first publisher; later versions must come from the same
GitHub identity. Versions are immutable.

## Environment

| Variable          | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `BRIKA_REGISTRY`  | Override the registry URL (default `https://registry.brika.dev`). |
| `BRIKA_TOKEN`     | Use this publish token instead of the saved login (for CI).   |

In CI, GitHub Actions OIDC is used instead of a token (audience `brika-registry`).
