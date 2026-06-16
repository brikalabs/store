# Example Brika plugins

Real, publishable plugins used to exercise the full publish -> resolve -> install
pipeline end to end. Each one is a valid Brika plugin (passes
`RegistryPublishSchema`) and ships the store metadata the registry's publish gate
requires (icon + `displayName` + `description` + localized `locales/<lang>/store.json`).

| Plugin | What it exercises |
| --- | --- |
| [`plugin-i18n`](./plugin-i18n) | Localized store metadata in 4 locales (`en`/`fr`/`de`/`es`), a localized README (`README.md` + `README.fr.md`), screenshots with captions, tools + a transform block, dropdown/password preferences. |
| [`plugin-snapshot`](./plugin-snapshot) | Compression: a 200 KB sample-state file that gzips ~17x in the tarball, plus a runtime gzip/brotli snapshot API. Bricks with per-instance config, `resources` caps, byte-string sizes. |
| [`plugin-clock`](./plugin-clock) | The remaining capability kinds: sparks and pages, plus an interval trigger block. |

Icons were generated with [`@brika/icon-studio`](https://www.npmjs.com/package/@brika/icon-studio):

```sh
bunx @brika/icon-studio languages --preset sunset  -o plugin-i18n/assets/icon.svg
bunx @brika/icon-studio camera    --preset ocean   -o plugin-snapshot/assets/icon.svg
bunx @brika/icon-studio clock     --preset midnight -o plugin-clock/assets/icon.svg
```

## Publishing them to a local registry

```sh
# 1. Start the registry (shares the store's local D1 + R2 state)
bun run --filter @brika/registry dev      # http://localhost:8787

# 2. Get a publish token via the device flow (the store /device page approves it),
#    then publish each plugin:
export BRIKA_REGISTRY=http://localhost:8787
export BRIKA_TOKEN=brika_...               # from `brika login` or the device flow
bun apps/cli/src/index.ts publish ./examples/plugin-i18n
bun apps/cli/src/index.ts publish ./examples/plugin-snapshot
bun apps/cli/src/index.ts publish ./examples/plugin-clock

# 3. Install one from the registry, npm-compatible:
#    bunfig.toml -> [install.scopes] "@brika" = "http://localhost:8787/"
bun add @brika/plugin-snapshot
```

These also double as fixtures for the publish-pipeline tests.
