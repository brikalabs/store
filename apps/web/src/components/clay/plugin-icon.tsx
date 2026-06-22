import { Avatar, AvatarFallback, AvatarImage, cn } from "@brika/clay";
import { Box, Boxes, Code, FileText, Layers, type LucideIcon, Zap } from "lucide-react";
import { gradientCss, gradientFor } from "./gradients";

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
  const Glyph = glyphFor(capabilities);
  // Clay's Avatar (Radix) shows the icon only once it LOADS, so a missing/404/broken icon
  // falls back to the gradient + capability tile instead of the broken-image glyph.
  return (
    <Avatar
      data-slot="plugin-icon"
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {iconUrl ? (
        <AvatarImage
          src={iconUrl}
          alt=""
          className="border border-border object-cover"
          style={{ borderRadius: radius }}
        />
      ) : null}
      <AvatarFallback
        className="text-white"
        style={{
          borderRadius: radius,
          background: gradientCss(gradientFor(name)),
          boxShadow: TILE_SHADOW,
        }}
      >
        <Glyph size={Math.round(size * 0.5)} strokeWidth={1.8} />
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Gradient initials tile for user/author/scope avatars. When `imageUrl` is given it shows once
 * loaded; a missing or failed image degrades to the gradient + initials (no broken-image glyph).
 */
export function GradientAvatar({
  seed,
  label,
  imageUrl,
  size = 40,
  className,
}: Readonly<{
  seed: string;
  label: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}>) {
  const initials =
    label
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  // Clay's Avatar (Radix) renders the image only once it LOADS, so a missing/404/broken image
  // stays on the gradient + initials fallback instead of the broken-image glyph.
  const radius = Math.round(size * 0.26);
  return (
    <Avatar
      data-slot="gradient-avatar"
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <AvatarImage
          src={imageUrl}
          alt=""
          className="object-cover"
          style={{ borderRadius: radius }}
        />
      ) : null}
      <AvatarFallback
        className="font-bold font-heading text-white leading-none"
        style={{
          borderRadius: radius,
          fontSize: Math.round(size * 0.36),
          background: gradientCss(gradientFor(seed)),
          boxShadow: TILE_SHADOW,
        }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export type { Gradient } from "./gradients";
