import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Slider,
} from "@brika/clay";
import {
  Eraser,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const STAGE = 288; // on-screen crop stage, in px
const OUTPUT = 512; // exported square, in px

type Transform = {
  zoom: number;
  x: number;
  y: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
};
const IDENTITY: Transform = { zoom: 1, x: 0, y: 0, rotation: 0, flipH: false, flipV: false };

/** Effective image dimensions after a 90°-step rotation (axes swap at 90/270). */
function effective(img: HTMLImageElement, rotation: number): { w: number; h: number } {
  const swap = rotation % 180 !== 0;
  return { w: swap ? img.height : img.width, h: swap ? img.width : img.height };
}

/** The scale (image px -> STAGE px) that makes the image just cover the square stage. */
function coverScale(img: HTMLImageElement, rotation: number): number {
  const { w, h } = effective(img, rotation);
  return Math.max(STAGE / w, STAGE / h);
}

/** Draw the transformed image into `ctx` for a canvas of side `size`. */
function paint(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: Transform,
  size: number,
): void {
  const r = size / STAGE;
  const k = coverScale(img, t.rotation) * t.zoom * r;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2 + t.x * r, size / 2 + t.y * r);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale((t.flipH ? -1 : 1) * k, (t.flipV ? -1 : 1) * k);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

/** Keep the offset within bounds so the scaled image always covers the stage. */
function clampOffset(img: HTMLImageElement, t: Transform): { x: number; y: number } {
  const { w, h } = effective(img, t.rotation);
  const scale = coverScale(img, t.rotation) * t.zoom;
  const maxX = Math.max(0, (w * scale - STAGE) / 2);
  const maxY = Math.max(0, (h * scale - STAGE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, t.x)),
    y: Math.min(maxY, Math.max(-maxY, t.y)),
  };
}

/**
 * A reposition/zoom/rotate cropper for avatars and logos. Loads the picked file, lets the user pan
 * (drag), zoom (wheel or slider), rotate and flip, then exports a square WebP blob the caller
 * uploads. Output is a real raster crop, so the existing image endpoints accept it unchanged.
 */
export function ImageCropModal({
  file,
  title,
  shape = "circle",
  onCancel,
  onApply,
}: Readonly<{
  file: File | null;
  title: string;
  shape?: "circle" | "rounded";
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [t, setT] = useState<Transform>(IDENTITY);

  // Load the picked file into an <img> and reset the transform.
  useEffect(() => {
    if (file === null) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setT(IDENTITY);
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Repaint the preview whenever the loaded image or the transform changes.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null || img === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx !== null) paint(ctx, img, t, STAGE);
  }, [img, t]);
  useEffect(redraw, [redraw]);

  // Accepts a plain patch or a function of the previous transform, so the rapid pan/zoom handlers
  // compose from the latest committed state (not a stale render closure) when events batch.
  function update(patch: Partial<Transform> | ((prev: Transform) => Partial<Transform>)) {
    setT((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      return img === null ? next : { ...next, ...clampOffset(img, next) };
    });
  }

  function onPointerDown(event: ReactPointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  }
  function onPointerMove(event: ReactPointerEvent) {
    if (drag.current === null) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    update((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function apply() {
    if (img === null) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT;
    out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (ctx === null) return;
    paint(ctx, img, t, OUTPUT);
    out.toBlob((blob) => blob && onApply(blob), "image/webp", 0.9);
  }

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="w-[380px] max-w-[calc(100vw-2rem)] gap-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag to reposition · scroll or slide to zoom.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={(e) =>
              update((prev) => ({ zoom: Math.min(3, Math.max(1, prev.zoom - e.deltaY * 0.001)) }))
            }
            className="relative size-72 cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-accent active:cursor-grabbing"
          >
            <canvas ref={canvasRef} width={STAGE} height={STAGE} className="size-72" />
            <div
              className={`pointer-events-none absolute inset-0 ${shape === "circle" ? "rounded-full" : "rounded-2xl"} shadow-[0_0_0_9999px_rgba(15,12,8,0.42)]`}
            />
            <div
              className={`pointer-events-none absolute inset-0 border border-white/45 ${shape === "circle" ? "rounded-full" : "rounded-2xl"}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut className="size-4 text-muted-foreground" />
          <Slider
            min={1}
            max={3}
            step={0.01}
            value={t.zoom}
            onChange={(z) => update({ zoom: z })}
            className="flex-1"
          />
          <ZoomIn className="size-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-2">
          <CropTool
            label="Rotate left"
            onClick={() => update({ rotation: (t.rotation + 270) % 360 })}
          >
            <RotateCcw className="size-4" />
          </CropTool>
          <CropTool
            label="Rotate right"
            onClick={() => update({ rotation: (t.rotation + 90) % 360 })}
          >
            <RotateCw className="size-4" />
          </CropTool>
          <CropTool
            label="Flip horizontal"
            active={t.flipH}
            onClick={() => update({ flipH: !t.flipH })}
          >
            <FlipHorizontal className="size-4" />
          </CropTool>
          <CropTool
            label="Flip vertical"
            active={t.flipV}
            onClick={() => update({ flipV: !t.flipV })}
          >
            <FlipVertical className="size-4" />
          </CropTool>
          <CropTool label="Reset" onClick={() => setT(IDENTITY)}>
            <Eraser className="size-4" />
          </CropTool>
        </div>

        <div className="flex gap-2.5">
          <Button type="button" variant="outline" onClick={onCancel} className="h-11 flex-1">
            Cancel
          </Button>
          <Button type="button" onClick={apply} className="h-11 flex-1">
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CropTool({
  label,
  active = false,
  onClick,
  children,
}: Readonly<{ label: string; active?: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <Button
      type="button"
      variant="outline"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`h-10 flex-1 gap-1.5 rounded-xl border font-semibold text-xs ${
        active
          ? "border-brand-border bg-brand-tint text-brand-ink hover:bg-brand-tint hover:text-brand-ink"
          : "border-input bg-card text-muted-foreground hover:border-brand-border hover:bg-card hover:text-brand-ink"
      }`}
    >
      {children}
    </Button>
  );
}
