import { DiscoverIndex } from "@/components/plugin/discover-index";
import type { DirectionProps } from "./direction-spotlight";

export function DirectionConsole({ plugins, total }: DirectionProps) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <DiscoverIndex plugins={plugins} total={total} />
    </main>
  );
}
