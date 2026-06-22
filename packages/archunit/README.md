# @brika/archunit

A tiny ArchUnit-style architecture-rule engine. Declare rules fluently, by package/folder glob, so
they scale as packages, controllers, and adapters are added. Rules check **imports**, **filenames**,
or **class names**. Bun runtime (`Bun.Glob`); import-aware (comments are stripped, so an `import`
inside a JSDoc example is not counted).

The repo's rules live in [`architecture/`](../../architecture) and run as ordinary `bun:test` tests.

## Use it

```ts
import { rule, modules } from "@brika/archunit";

// layering: the domain core imports no database
rule().filesMatching("packages/*-core/src").mayNotImport(modules("drizzle-orm")).assert();

// filename convention: adapter files are kebab-case
rule().filesMatching("apps/registry/src/adapters").mustBeNamed(/^[a-z0-9-]+\.ts$/).assert();

// class-name convention: D1-backed adapters are prefixed "D1"
rule().filesMatching("apps/registry/src/adapters/d1-*.ts").classesMustBePrefixed("D1").assert();
```

## API

- **`rule()`** - the fluent builder: `.filesMatching(glob)` (narrow with `.except(glob, ...)`) then a check:
  - imports: `.mayNotImport(category)`
  - filenames: `.mustBeNamed(regexp)`
  - classes: `.classesMustBePrefixed` / `.classesMustBeSuffixed` / `.classesMustBeNamed(re)` /
    `.classesMustNotBeNamed(re)` (e.g. forbid an infra prefix leaking into the domain core).
- **`.assert()`** throws on violation (call inside your own `test()`); **`.check()`** returns the
  violation lines for other uses.
- **`modules(...)`** / **`category(...)`** - name a set of import specifiers to match against.
- **naming helpers** - `kebabCase` / `pascalCase` / `camelCase` / `kebabFilename`.

## Tests

```sh
bun test   # the engine itself; the repo's architecture rules live in /architecture
```
