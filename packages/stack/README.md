# @brika/stack

Best-effort source-location helpers over `Error.stack`. **Diagnostics only**: they surface source
paths in dev, tests, and source-mapped builds, and degrade to `undefined` / `""` when a stack is
missing or in an unexpected shape - they never throw. The V8 frame parsing lives here once rather
than copied into each consumer.

Used by `@brika/router` (naming a route by where it was defined) and `@brika/di` (naming a token by
its declaration site, so a missing-provider error reads `InjectionToken(server/services.ts:41)`).

## API

- **`frameLocation(frame)`** - `file:line:col` from one stack frame (`at fn (path:1:2)` or
  `at path:1:2`), or `undefined`. String-scanned, no backtracking regex.
- **`moduleFile(stack)`** - the first real (non-`node:`, non-`<anonymous>`) frame's FILE, with the
  trailing `:line:col` stripped. Capture from a load-time `new Error().stack` to learn a module's own
  file.
- **`callerFrame(stack, selfFile)`** - the first frame OUTSIDE `selfFile`: where a helper was called
  from, skipping the helper's own module.

## Tests

```sh
bun test   # frame parsing across V8 forms, file:// stripping, and the degrade-to-empty cases
```
