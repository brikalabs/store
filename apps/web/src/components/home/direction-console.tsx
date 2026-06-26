import type { SearchDirection } from "@brika/registry-contract";
import { useState } from "react";
import { DiscoverIndex } from "@/components/plugin/discover-index";
import { type SortKey, sortPlugins } from "@/components/plugin/sort-menu";
import type { DirectionProps } from "./direction-spotlight";

/** The home A/B "Console" variant: the same discovery layout, sorted/filtered in memory (no paging). */
export function DirectionConsole({ plugins }: DirectionProps) {
  const [field, setField] = useState<SortKey>("downloads");
  const [direction, setDirection] = useState<SearchDirection>("desc");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const visible = verifiedOnly ? plugins.filter((plugin) => plugin.verified) : plugins;
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <DiscoverIndex
        plugins={sortPlugins(visible, field, direction)}
        railsPlugins={visible}
        count={visible.length}
        field={field}
        direction={direction}
        verifiedOnly={verifiedOnly}
        onSortChange={(nextField, nextDirection) => {
          setField(nextField);
          setDirection(nextDirection);
        }}
        onVerifiedChange={setVerifiedOnly}
      />
    </main>
  );
}
