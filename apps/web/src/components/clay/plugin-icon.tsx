import { cn } from "@brika/clay";
import { Box, Boxes, Code, FileText, Layers, type LucideIcon, Zap } from "lucide-react";
import { type Gradient, gradientCss, gradientFor } from "./gradients";

export type CapabilityCounts = {
  tools: number;
  blocks: number;
  bricks: number;
  sparks: number;
  pages: number;
};

const CAPABILITY_GLYPH: Record<keyof CapabilityCounts, LucideIcon> = {
  bricks: Box,
  tools: Code,
  blocks: Layers,
  sparks: Zap,
  pages: FileText,
};

function glyphFor(capabilities?: CapabilityCounts): LucideIcon {
  if (!capabilities) return Boxes;
  let best: keyof CapabilityCounts | null = null;
  let bestCount = 0;
  for (const key of Object.keys(CAPABILITY_GLYPH) as (keyof CapabilityCounts)[]) {
    if (capabilities[key] > bestCount) {
      best = key;
      bestCount = capabilities[key];
    }
  }
  return best ? CAPABILITY_GLYPH[best] : Boxes;
}

const TILE_SHADOW = "0 2px 5px rgba(0,0,0,0.13), inset 0 1px 0 rgba(255,255,255,0.4)";

/**
 * App-store style plugin icon. Renders the package's real icon when present,
 * otherwise a deterministic colorful gradient tile with a capability glyph.
 */
export function PluginIcon({
  name,
  iconUrl,
  capabilities,
  size = 44,
  className,
}: Readonly<{
  name: string;
  iconUrl?: string;
  capabilities?: CapabilityCounts;
  size?: number;
  className?: string;
}>) {
  const radius = Math.round(size * 0.26);

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        width={size}
        height={size}
        className={cn("shrink-0 border border-border object-cover", className)}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const Glyph = glyphFor(capabilities);
  return (
    <span
      data-slot="plugin-icon"
      className={cn("inline-flex shrink-0 items-center justify-center text-white", className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: gradientCss(gradientFor(name)),
        boxShadow: TILE_SHADOW,
      }}
    >
      <Glyph size={Math.round(size * 0.5)} strokeWidth={1.8} />
    </span>
  );
}

/** Gradient initials tile, used for author/developer avatars. */
export function GradientAvatar({
  seed,
  label,
  size = 40,
  className,
}: Readonly<{ seed: string; label: string; size?: number; className?: string }>) {
  const initials =
    label
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <span
      data-slot="gradient-avatar"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold font-heading text-white leading-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        fontSize: Math.round(size * 0.36),
        background: gradientCss(gradientFor(seed)),
        boxShadow: TILE_SHADOW,
      }}
    >
      {initials}
    </span>
  );
}

export type { Gradient };
