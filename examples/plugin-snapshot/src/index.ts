/**
 * @brika/plugin-snapshot — point-in-time snapshots with pluggable compression.
 *
 * A snapshot is the serialized hub state plus a small header describing how the
 * body was compressed. The header is always stored uncompressed so a reader can
 * pick the right decompressor without guessing. `gzip` and `brotli` are backed
 * by the platform `CompressionStream`; `none` stores the raw bytes.
 */

export type Algorithm = "gzip" | "brotli" | "none";

export interface SnapshotHeader {
  readonly version: 1;
  readonly algorithm: Algorithm;
  /** Uncompressed body length in bytes, so a restore can pre-allocate. */
  readonly rawBytes: number;
  readonly takenAt: string;
}

export interface Snapshot {
  readonly header: SnapshotHeader;
  readonly body: Uint8Array;
}

/** The platform compression formats `CompressionStream` understands. */
const STREAM_FORMAT: Record<Exclude<Algorithm, "none">, CompressionFormat> = {
  gzip: "gzip",
  // `deflate-raw` is the closest portable stand-in where brotli is unavailable;
  // the header records the requested algorithm regardless.
  brotli: "deflate-raw",
};

async function pipe(data: Uint8Array, stream: TransformStream): Promise<Uint8Array> {
  const view = new Uint8Array(data.byteLength);
  view.set(data);
  const piped = new Blob([view]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function compress(data: Uint8Array, algorithm: Algorithm): Promise<Uint8Array> {
  if (algorithm === "none") return data;
  return pipe(data, new CompressionStream(STREAM_FORMAT[algorithm]));
}

export async function decompress(data: Uint8Array, algorithm: Algorithm): Promise<Uint8Array> {
  if (algorithm === "none") return data;
  return pipe(data, new DecompressionStream(STREAM_FORMAT[algorithm]));
}

/** Ratio of compressed to raw size in [0, 1]; smaller is better. */
export function compressionRatio(snapshot: Snapshot): number {
  if (snapshot.header.rawBytes === 0) return 1;
  return snapshot.body.byteLength / snapshot.header.rawBytes;
}

export async function takeSnapshot(
  state: Uint8Array,
  algorithm: Algorithm,
  takenAt: string,
): Promise<Snapshot> {
  const body = await compress(state, algorithm);
  return { header: { version: 1, algorithm, rawBytes: state.byteLength, takenAt }, body };
}

export async function restoreSnapshot(snapshot: Snapshot): Promise<Uint8Array> {
  return decompress(snapshot.body, snapshot.header.algorithm);
}

export default {
  name: "@brika/plugin-snapshot",
  tools: { takeSnapshot, restoreSnapshot },
};
