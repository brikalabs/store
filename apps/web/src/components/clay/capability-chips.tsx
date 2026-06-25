import { cn } from "@brika/clay";
import { Box, Code, FileText, Layers, type LucideIcon, Zap } from "lucide-react";
import { useT } from "@/i18n";
import { type Gradient, gradientCss } from "./gradients";
import type { CapabilityCounts } from "./plugin-icon";

type CapabilityMeta = { glyph: LucideIcon; gradient: Gradient };

const CAPABILITY_META: Record<keyof CapabilityCounts, CapabilityMeta> = {
  tools: { glyph: Code, gradient: ["#FF8A5B", "#F2542D"] },
  blocks: { glyph: Layers, gradient: ["#5B8DEF", "#3A5BD9"] },
  bricks: { glyph: Box, gradient: ["#19C39C", "#0E8C6F"] },
  sparks: { glyph: Zap, gradient: ["#A66BFF", "#6D34C9"] },
  pages: { glyph: FileText, gradient: ["#7C8696", "#525C6B"] },
};

const CAPABILITY_KEY = {
  tools: "clay:capabilityTools",
  blocks: "clay:capabilityBlocks",
  bricks: "clay:capabilityBricks",
  sparks: "clay:capabilitySparks",
  pages: "clay:capabilityPages",
} as const;

const ORDER: (keyof CapabilityCounts)[] = ["bricks", "tools", "blocks", "sparks", "pages"];

/** Pill row describing the capabilities a plugin adds to a hub. */
export function CapabilityChips({
  capabilities,
  className,
}: Readonly<{ capabilities?: CapabilityCounts; className?: string }>) {
  const t = useT();
  if (!capabilities) return null;
  const present = ORDER.filter((key) => capabilities[key] > 0);
  if (present.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {present.map((key) => {
        const meta = CAPABILITY_META[key];
        const Glyph = meta.glyph;
        return (
          <span
            key={key}
            className="flex items-center gap-2 rounded-[9px] border border-border bg-card px-3 py-1.5 font-medium text-foreground text-sm"
          >
            <span
              className="inline-flex size-6 items-center justify-center rounded-[7px] text-white"
              style={{ background: gradientCss(meta.gradient) }}
            >
              <Glyph className="size-3.5" />
            </span>
            {t(CAPABILITY_KEY[key], { count: capabilities[key] })}
          </span>
        );
      })}
    </div>
  );
}
