/**
 * A tiny browser image pipeline, a little like sharp: decode -> resize -> re-encode, on a Canvas.
 * Lazy and immutable - each step returns a new {@link Image} and nothing runs until `toBlob()`:
 *
 *   const webp = await image(file).resize({ width: 512, height: 512 }).webp({ quality: 0.85 }).toBlob();
 *
 * Browser-only (uses `createImageBitmap` + `OffscreenCanvas`); the resize MATH is a pure, tested
 * function so the geometry is verifiable without a canvas.
 */

export type Fit = "inside" | "cover";

export interface ResizeOptions {
  readonly width?: number;
  readonly height?: number;
  /**
   * "inside" (default): scale to fit WITHIN `width` x `height`, keeping aspect ratio, never
   * upscaling. "cover": fill `width` x `height` exactly, center-cropping the overflow.
   */
  readonly fit?: Fit;
}

export interface EncodeOptions {
  /** Encoder quality, 0..1 (WebP and JPEG only; ignored for PNG). */
  readonly quality?: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

interface Pipeline {
  readonly resize?: ResizeOptions;
  readonly type: string;
  readonly quality?: number;
}

/**
 * The output canvas size for a `source` given the resize options - the pure, testable core of the
 * pipeline. "inside" scales to fit within the box (never up), "cover" returns the exact box (the
 * crop happens at draw time), and no options passes the source size through.
 */
export function targetSize(source: Size, resize: ResizeOptions | undefined): Size {
  if (resize === undefined) return { width: source.width, height: source.height };
  const { width, height, fit = "inside" } = resize;
  if (fit === "cover") {
    return { width: width ?? source.width, height: height ?? source.height };
  }
  const byWidth = width === undefined ? 1 : width / source.width;
  const byHeight = height === undefined ? 1 : height / source.height;
  const scale = Math.min(1, byWidth, byHeight);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

/** The starting pipeline: WebP output, no resize. Shared + never mutated (steps spread into a new one). */
const DEFAULT_PIPELINE: Pipeline = { type: "image/webp" };

/** A lazily-built image pipeline. Construct it with {@link image}; chain `resize`/`webp`/... ; `toBlob()`. */
export class Image {
  readonly #source: Blob;
  readonly #pipeline: Pipeline;

  constructor(source: Blob, pipeline: Pipeline = DEFAULT_PIPELINE) {
    this.#source = source;
    this.#pipeline = pipeline;
  }

  resize(options: ResizeOptions): Image {
    return new Image(this.#source, { ...this.#pipeline, resize: options });
  }

  webp(options: EncodeOptions = {}): Image {
    return new Image(this.#source, {
      ...this.#pipeline,
      type: "image/webp",
      quality: options.quality,
    });
  }

  jpeg(options: EncodeOptions = {}): Image {
    return new Image(this.#source, {
      ...this.#pipeline,
      type: "image/jpeg",
      quality: options.quality,
    });
  }

  png(): Image {
    return new Image(this.#source, { ...this.#pipeline, type: "image/png", quality: undefined });
  }

  /** Run the pipeline (decode -> resize -> encode) and return the encoded blob. */
  async toBlob(): Promise<Blob> {
    const bitmap = await createImageBitmap(this.#source);
    try {
      const out = targetSize(bitmap, this.#pipeline.resize);
      const canvas = new OffscreenCanvas(out.width, out.height);
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("Canvas 2D context unavailable");
      draw(ctx, bitmap, this.#pipeline.resize, out);
      return await canvas.convertToBlob({
        type: this.#pipeline.type,
        quality: this.#pipeline.quality,
      });
    } finally {
      bitmap.close();
    }
  }
}

/** Draw the bitmap into the (already aspect-correct) canvas; a "cover" fit scales up + center-crops. */
function draw(
  ctx: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  resize: ResizeOptions | undefined,
  out: Size,
): void {
  if (resize?.fit !== "cover") {
    ctx.drawImage(bitmap, 0, 0, out.width, out.height);
    return;
  }
  const scale = Math.max(out.width / bitmap.width, out.height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  ctx.drawImage(
    bitmap,
    (out.width - drawWidth) / 2,
    (out.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

/** Start a pipeline from a source blob/file. */
export function image(source: Blob): Image {
  return new Image(source);
}
