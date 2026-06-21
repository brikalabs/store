import { getRouteApi, Link } from "@tanstack/react-router";
import { Segmented, segmentClassName } from "@/components/clay/segmented";
import { DirectionConsole } from "./direction-console";
import { DirectionSpotlight } from "./direction-spotlight";

const route = getRouteApi("/");

export function HomePage() {
  const { plugins, total } = route.useLoaderData();
  const { d } = route.useSearch();
  const direction = d ?? "a";

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 pt-7">
        <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.07em]">
          Direction
        </span>
        <Segmented>
          <Link to="/" search={{ d: "a" }} className={segmentClassName(direction === "a")}>
            Spotlight
          </Link>
          <Link to="/" search={{ d: "b" }} className={segmentClassName(direction === "b")}>
            Console
          </Link>
        </Segmented>
      </div>
      {direction === "b" ? (
        <DirectionConsole plugins={plugins} total={total} />
      ) : (
        <DirectionSpotlight plugins={plugins} total={total} />
      )}
    </div>
  );
}
