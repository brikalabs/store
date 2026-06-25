import type { SearchCapability } from "@brika/registry-contract";
import { Box, Code, FileText, Layers, type LucideIcon, Zap } from "lucide-react";
import type { Gradient } from "@/components/clay/gradients";

/** A Brika capability shown as a browse shortcut: its key, label, glyph, and avatar gradient. */
export type CapabilityTile = {
  key: SearchCapability;
  label: string;
  glyph: LucideIcon;
  gradient: Gradient;
};

export const CAPABILITY_TILES: CapabilityTile[] = [
  { key: "tools", label: "Tools", glyph: Code, gradient: ["#FF8A5B", "#F2542D"] },
  { key: "blocks", label: "Blocks", glyph: Layers, gradient: ["#5B8DEF", "#3A5BD9"] },
  { key: "bricks", label: "Bricks", glyph: Box, gradient: ["#19C39C", "#0E8C6F"] },
  { key: "sparks", label: "Sparks", glyph: Zap, gradient: ["#A66BFF", "#6D34C9"] },
  { key: "pages", label: "Pages", glyph: FileText, gradient: ["#7C8696", "#525C6B"] },
];
