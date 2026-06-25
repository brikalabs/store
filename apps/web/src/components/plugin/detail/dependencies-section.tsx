import { Box, Layers, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/i18n";

/** An uppercase group label row inside the dependencies card. */
function DepGroupLabel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="border-border border-b bg-muted px-4 py-2 font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.05em]">
      {children}
    </div>
  );
}

/** One dependency row: name (brand-marked / muted) on the left, range on the right. */
function DepRow({
  name,
  range,
  brand,
  muted,
  hubPeer,
}: Readonly<{ name: string; range: string; brand?: boolean; muted?: boolean; hubPeer?: boolean }>) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-2.5">
      <span
        className={`inline-flex min-w-0 items-center gap-2 font-mono text-xs ${muted ? "text-muted-foreground" : "text-brand"}`}
      >
        <Box className="size-3.5 shrink-0 text-muted-foreground/70" />
        <span className="truncate">{name}</span>
        {brand ? <ShieldCheck className="size-3 shrink-0 text-brand" /> : null}
        {hubPeer ? (
          <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 font-medium font-sans text-[10px] text-muted-foreground">
            {t("pluginDetail:providedByHub")}
          </span>
        ) : null}
      </span>
      <span
        className={`shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {range}
      </span>
    </div>
  );
}

/**
 * Dependencies grouped by type (runtime / peer / dev) with version ranges. No resolved
 * versions, since the store only has the manifest's package.json.
 */
export function DependenciesSection({
  dependencies,
  peerDependencies,
  devDependencies,
  brikaEngine,
}: Readonly<{
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  brikaEngine: string;
}>) {
  const t = useT();
  const deps = Object.entries(dependencies ?? {});
  const peers: [string, string][] = [
    ["brika", brikaEngine],
    ...Object.entries(peerDependencies ?? {}).filter(([name]) => name !== "brika"),
  ];
  const dev = Object.entries(devDependencies ?? {});
  const DEV_CAP = 8;
  const devShown = dev.slice(0, DEV_CAP);
  const devMore = dev.length - devShown.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
          <Layers className="size-4 text-muted-foreground" />
          {t("pluginDetail:dependenciesHeading")}
        </h2>
        <span className="text-muted-foreground text-xs">
          {t("pluginDetail:declaredInPackageJson")}
        </span>
      </div>
      <div className="flex items-center gap-4 text-muted-foreground text-xs">
        <span>
          <strong className="text-foreground">{deps.length}</strong>{" "}
          {t("pluginDetail:runtimeCount")}
        </span>
        <span>
          <strong className="text-foreground">{peers.length}</strong> {t("pluginDetail:peerCount")}
        </span>
        <span>
          <strong className="text-foreground">{dev.length}</strong> {t("pluginDetail:devCount")}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {deps.length > 0 ? (
          <>
            <DepGroupLabel>{t("pluginDetail:depGroupDependencies")}</DepGroupLabel>
            {deps.map(([name, range]) => (
              <DepRow key={name} name={name} range={range} brand={name.startsWith("@brika/")} />
            ))}
          </>
        ) : null}
        <DepGroupLabel>{t("pluginDetail:depGroupPeer")}</DepGroupLabel>
        {peers.map(([name, range]) => (
          <DepRow key={name} name={name} range={range} hubPeer />
        ))}
        {dev.length > 0 ? (
          <>
            <DepGroupLabel>
              {t("pluginDetail:depGroupDev")}{" "}
              <span className="font-normal text-muted-foreground/60 normal-case">
                · {t("pluginDetail:depGroupDevNote")}
              </span>
            </DepGroupLabel>
            {devShown.map(([name, range]) => (
              <DepRow key={name} name={name} range={range} muted />
            ))}
            {devMore > 0 ? (
              <div className="px-4 py-2.5 text-muted-foreground text-xs">
                {t("pluginDetail:moreDevDependencies", { count: devMore })}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
        <Box className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
        {t("pluginDetail:dependenciesFootnote")}
      </div>
    </section>
  );
}
