# Snapshot & Compress

Capture point-in-time snapshots of your hub state and store them compressed.
Choose `gzip`, `brotli`, or `none`, set a compression level, and keep a rolling
window of recent snapshots.

## How it works

A snapshot is a small uncompressed **header** followed by the compressed
**body**. Storing the header in the clear means a restore never has to guess the
algorithm:

```ts
import { takeSnapshot, restoreSnapshot, compressionRatio } from "@brika/plugin-snapshot";

const snap = await takeSnapshot(stateBytes, "gzip", new Date().toISOString());
console.log(`saved ${Math.round(compressionRatio(snap) * 100)}% of original size`);

const restored = await restoreSnapshot(snap);
```

## Tools

- **take-snapshot** - capture the current hub state as a compressed snapshot.
- **restore-snapshot** - restore hub state from a snapshot.

## Bricks

- **Snapshot status** - a board brick showing the latest snapshot's size, age,
  and (optionally) its compression ratio.

## Preferences

| Preference   | Type     | Default | Notes                                    |
| ------------ | -------- | ------- | ---------------------------------------- |
| `algorithm`  | dropdown | gzip    | `gzip`, `brotli`, or `none`.             |
| `level`      | number   | 6       | 1–9; higher compresses more.             |
| `retention`  | number   | 10      | How many snapshots to keep.              |
