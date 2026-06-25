import { Monitor, Moon, Sun } from "lucide-react";
import { SegmentedControl, type SegmentOption } from "@/components/clay/segmented";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";
import { useT } from "@/i18n";

/** Light / Dark / System control in the account menu. */
export function ThemeSegment() {
  const t = useT();
  const { mode, setMode } = useTheme();
  const options: SegmentOption<ThemeMode>[] = [
    { value: "light", label: t("layout:themeLight"), icon: Sun },
    { value: "dark", label: t("layout:themeDark"), icon: Moon },
    { value: "system", label: t("layout:themeSystem"), icon: Monitor },
  ];
  return (
    <SegmentedControl
      options={options}
      value={mode}
      onChange={setMode}
      ariaLabel={t("layout:theme")}
    />
  );
}
