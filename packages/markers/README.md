# brika-markers

One package for tracking the spots in the code that are intentionally
incomplete, so the gap between "declared" and "done" stays visible instead of
rotting. A single comment parser drives a CLI and a VSCode extension, so the
terminal, CI, and the editor never disagree about what counts as a marker.

## Kinds

The built-in defaults live in [`src/core/kinds.ts`](src/core/kinds.ts); a repo can
edit or extend them with a [`markers.config.json`](#config) at its root.

| Kind | Purpose | Severity |
| --- | --- | --- |
| `mock` | Synthesized stand-in **data** shown until the real source is wired (then delete) | info |
| `stub` | Placeholder **implementation/behaviour** that is not real logic yet | warning |
| `unenforced` | A limit, rule, or contract field **declared before it is enforced** in code | warning |
| `todo` | Planned work **not built yet** | info |
| `hack` | A deliberate **shortcut** that works but should be revisited | warning |
| `fixme` | A known **defect**: code that is wrong or fragile and needs a real fix | warning |

`mock` vs `stub`: mock is fake *data* (a rating, a review), stub is missing
*behaviour* (a handler returning a canned result). `hack` vs `fixme`: a hack
works but is ugly, a fixme is actually broken.

## Writing a marker

Mark the spot with a `// @kind: reason` comment, on or just above the line; the
reason is required. For a synthesized value, mark the **function** that produces
it (one marker), not each field it returns.

```ts
maxScopesPerUser: 3, // @unenforced: needs a count port

// @mock: D1 plugins rating / verified / featured
export function demoSummary(plugin) { ... }
```

Markers are comments, so nothing ships to a runtime bundle: they are a
dev/CI/editor concern only. Do not write the literal tag in prose inside a
`.ts`/`.tsx` file, or the scanner reads it as a real marker.

## Config

Drop a `markers.config.json` at the repo root to edit or add kinds; its entries
overlay the built-in defaults by name (override one, or append a new one):

```json
{
  "kinds": [
    { "name": "security", "description": "Close before shipping.", "severity": "error" }
  ]
}
```

`name` (lowercase), `description` are required; `title` (defaults from the name)
and `severity` (`info` | `warning` | `error`, defaults `info`) are optional.

## CLI

```sh
bun run markers                 # grouped report of every marker
bun run markers --kind mock     # one kind (repeatable)
bun run markers --path apps/web # paths containing a substring (repeatable)
bun run markers --blame         # annotate each marker with git author + date
bun run markers --sort date     # sort by date (implies --blame); also: file | kind
bun run markers --format json   # machine output: json | github | human
bun run unenforced              # alias for `markers --kind unenforced`
```

`--format github` emits GitHub Actions annotations. The CLI is informational and
always exits 0.

## VSCode extension

The same parser powers an editor extension with its own activity-bar icon:

- **Diagnostics** in the Problems panel, coloured by kind severity.
- **CodeLens** above each marker showing its kind and reason.
- A **tree view** grouped by kind, or toggled to a flat list sorted by git
  authorship date; each row shows the author and how long ago it was added (from
  `git blame`).

```sh
bun run markers:vscode           # just bundle to out/extension.cjs
bun run markers:vscode:install   # bundle + package a .vsix + install into your editor
```

`markers:vscode:install` installs into VSCode (`code`) by default; set
`BRIKA_EDITOR` to target another (`BRIKA_EDITOR=cursor bun run markers:vscode:install`).
For live development, press `F5` (the "Run Markers Extension" launch config).

## Library

```ts
import { scan, blameMarkers } from "./scan";          // git-grep + git-blame -> markers
import { parseText, resolveKinds } from "./core";     // pure, no fs (used by the editor)
import { format } from "./format";                    // render a ScanResult
```

`scan` and `blameMarkers` take injectable ports, so they are unit-tested without
a repo.
