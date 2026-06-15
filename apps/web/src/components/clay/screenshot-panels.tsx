import { cn } from "@brika/clay";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useState } from "react";
import { GRADIENTS, hashString } from "./gradients";
import { Image } from "./image";

const MAX_THUMBS = 5;

// Picsum's `/id/N` endpoint serves a specific pre-existing photo (no slow
// per-seed generation), so deterministic placeholders load quickly.
function placeholder(seed: string, index: number): string {
  const id = (hashString(seed) + index * 7) % 1000;
  return `https://picsum.photos/id/${id}/600/338`;
}

/** Deterministic number of placeholder screenshots (5..8) for a plugin. */
export function placeholderShotCount(seed: string): number {
  return 5 + (hashString(seed) % 4);
}

function gradientFor(seed: string, index: number) {
  return GRADIENTS[(hashString(seed) + index * 3) % GRADIENTS.length] ?? GRADIENTS[0];
}

/** Tasteful gradient used while/if a screenshot image can't be shown. */
function GradientFallback({
  seed,
  index,
  showIcon = true,
}: Readonly<{ seed: string; index: number; showIcon?: boolean }>) {
  const gradient = gradientFor(seed, index) as readonly [string, string];
  return (
    <div
      className="flex size-full items-center justify-center"
      style={{
        color: gradient[1],
        background: `linear-gradient(135deg, ${gradient[0]}33, ${gradient[1]}55)`,
      }}
    >
      {showIcon ? <ImageIcon className="size-8 opacity-45" /> : null}
    </div>
  );
}

/**
 * Screenshot gallery: a large featured image with prev/next navigation and a
 * counter, plus a clickable thumbnail strip (lazy-loaded, with gradient
 * fallbacks). Pass real `images`; when none are declared in the manifest,
 * deterministic placeholder photos keep the layout populated. The strip shows
 * the first {@link MAX_THUMBS}; any beyond collapse into a "+N" tile, and every
 * image stays reachable through the arrows.
 */
export function ScreenshotPanels({
  images,
  seed,
  count,
  className,
}: Readonly<{ images?: string[]; seed: string; count?: number; className?: string }>) {
  const total = images && images.length > 0 ? images.length : (count ?? placeholderShotCount(seed));
  const urls =
    images && images.length > 0
      ? images
      : Array.from({ length: total }, (_, index) => placeholder(seed, index));
  const [active, setActive] = useState(0);
  const safeActive = Math.min(active, urls.length - 1);
  const go = (delta: number) => setActive((urls.length + safeActive + delta) % urls.length);

  const visible = urls.slice(0, MAX_THUMBS);
  const overflow = urls.length - visible.length;

  return (
    <div data-slot="screenshot-panels" className={cn("flex flex-col gap-2.5", className)}>
      <div className="group relative h-80 overflow-hidden rounded-xl border border-border">
        <Image
          key={urls[safeActive]}
          src={urls[safeActive] as string}
          alt={`Screenshot ${safeActive + 1}`}
          loading="eager"
          timeoutMs={12000}
          className="size-full"
          fallback={<GradientFallback seed={seed} index={safeActive} />}
        />
        {urls.length > 1 ? (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
            <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 font-medium font-mono text-white text-xs">
              {safeActive + 1} / {urls.length}
            </span>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        {visible.map((url, index) => {
          const isOverflowTile = index === MAX_THUMBS - 1 && overflow > 0;
          return (
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={
                isOverflowTile ? `Show ${overflow + 1} more screenshots` : `Screenshot ${index + 1}`
              }
              className={cn(
                "relative h-16 overflow-hidden rounded-lg border-2 transition-colors",
                index === safeActive ? "border-brand" : "border-border",
              )}
            >
              <Image
                src={url}
                timeoutMs={12000}
                className="size-full"
                fallback={<GradientFallback seed={seed} index={index} showIcon={false} />}
              />
              {isOverflowTile ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-semibold text-sm text-white">
                  +{overflow + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ side, onClick }: Readonly<{ side: "left" | "right"; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous screenshot" : "Next screenshot"}
      className={cn(
        "absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 group-hover:opacity-100",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {side === "left" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}
