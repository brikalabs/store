import { Monitor, Moon, Sun } from "lucide-react";
import { SegmentedControl, type SegmentOption } from "@/components/clay/segmented";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";

const OPTIONS: SegmentOption<ThemeMode>[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Light / Dark / System control in the account menu. */
export function ThemeSegment() {
  const { mode, setMode } = useTheme();
  return <SegmentedControl options={OPTIONS} value={mode} onChange={setMode} ariaLabel="Theme" />;
}
