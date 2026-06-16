# @brika/cli-kit

A small CLI framework for Brika tools: declarative commands, a composable command
tree, and `@clack/prompts` UX. The `brika` CLI ([apps/cli](../../apps/cli)) is
built on it, and it is the same framework the hub CLI uses, so command syntax and
prompts match across tools.

> Vendored under `packages/cli-kit` from the hub monorepo until `@brika/cli-kit`
> is published. Keep it in sync; swap it for the published package once it ships.

## Usage

```ts
import { defineCommand, createCli } from "@brika/cli-kit";

const publish = defineCommand({
  name: "publish",
  description: "Publish the plugin in this directory",
  // options, args, and a typed handler...
  handler: async ({ args }) => { /* ... */ },
});

const cli = createCli({ name: "brika", commands: [publish] });
await cli.run();
```

- `defineCommand(spec)`: one command with typed options, args, and middleware.
- `createCli(config)`: assemble commands into a runnable CLI with generated help.
- `NamespaceSpec`: mount a command group flat or under a subcommand. A name that
  clashes fails fast with a `CliError` at startup rather than silently overriding.
- `generateHelp` / `generateCommandHelp`: the help text, if you need it directly.

## Exports

`@brika/cli-kit` (root) and `@brika/cli-kit/prompts` (the `@clack/prompts`
wrappers).

## Tests

```sh
bun test
```
