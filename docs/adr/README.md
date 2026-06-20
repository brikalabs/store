# Architecture Decision Records

Significant, hard-to-reverse decisions for the Brika platform, in
[MADR](https://adr.github.io/madr/) format. One file per decision, numbered and
append-only: supersede an old ADR with a new one rather than rewriting history.

Decisions reference the specs they drive (`docs/specs/`); specs describe behaviour,
ADRs explain why the shape is what it is.

## Log

| # | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](./0001-organisation-1n-model.md) | Organisation entity owning many scopes (1:N) | Superseded (org->scope merge) | 2026-06-20 |
| [0002](./0002-web-app-file-architecture.md) | apps/web file architecture (layered, alias-based) | Accepted | 2026-06-20 |

## Adding an ADR

1. Copy the most recent ADR as a starting structure.
2. Name it `NNNN-kebab-title.md` (next number).
3. Fill: Context, Decision drivers, Considered options, Decision outcome
   (+ Consequences), and link the specs it affects.
4. Add a row to the log above.
