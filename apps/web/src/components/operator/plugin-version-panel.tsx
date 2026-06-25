import { InputGroup, InputGroupAddon, InputGroupInput } from "@brika/clay/components/input-group";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { TakedownControls } from "@/components/operator/takedown-controls";
import type { OperatorPlugin, PluginVersion } from "@/hooks/use-operator-plugins";
import { type AppKey, useDateFormat, useT } from "@/i18n";
import { formatBytes } from "@/lib/format";

type VerFacet = "all" | "active" | "deprecated" | "yanked" | "takedown";

const VER_PREDICATES: Record<VerFacet, (v: PluginVersion) => boolean> = {
  all: () => true,
  active: (v) => v.takedownReason === null && !v.yanked && v.deprecated === null,
  deprecated: (v) => v.deprecated !== null,
  yanked: (v) => v.yanked,
  takedown: (v) => v.takedownReason !== null,
};

const VER_FACETS: { key: VerFacet; labelKey: AppKey }[] = [
  { key: "all", labelKey: "operator:versionFacetAll" },
  { key: "active", labelKey: "operator:versionFacetActive" },
  { key: "deprecated", labelKey: "operator:versionFacetDeprecated" },
  { key: "yanked", labelKey: "operator:versionFacetYanked" },
  { key: "takedown", labelKey: "operator:versionFacetTakedown" },
];

export function VersionPanel({
  pkg,
  versions,
  busy,
  onAct,
}: Readonly<{
  pkg: OperatorPlugin;
  versions: PluginVersion[] | null;
  busy: string | null;
  onAct: (version: string, path: "takedown" | "restore", reason?: string) => void;
}>) {
  const t = useT();
  const date = useDateFormat();
  const [facet, setFacet] = useState<VerFacet>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    if (versions === null) return [];
    const needle = query.trim().toLowerCase();
    return versions
      .filter(VER_PREDICATES[facet])
      .filter((v) => needle === "" || v.version.toLowerCase().includes(needle));
  }, [versions, facet, query]);

  return (
    <div className="border-border border-t bg-muted/30 py-3.5 pr-4 pl-12">
      {versions === null ? (
        <p className="py-1 text-muted-foreground text-sm">{t("operator:versionsLoading")}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-foreground text-sm">
              {t("operator:publishedVersions", { count: pkg.versionCount })}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VER_FACETS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFacet(f.key)}
                  className={`rounded-lg border px-2.5 py-1 font-medium text-xs transition-colors ${
                    f.key === facet
                      ? "border-brand/40 bg-brand/10 text-brand-ink"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
            <div className="min-w-3 flex-1" />
            <InputGroup className="w-44 h-8">
              <InputGroupAddon align="inline-start">
                <Search className="size-3.5 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("operator:findVersionPlaceholder")}
                className="font-mono text-xs"
              />
            </InputGroup>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {shown.length === 0 ? (
              <li className="px-4 py-3 text-muted-foreground text-sm">
                {t("operator:versionsEmpty")}
              </li>
            ) : (
              shown.map((v) => (
                <li key={v.version} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 font-mono font-semibold text-sm">{v.version}</span>
                  {v.version === pkg.latestVersion && v.takedownReason === null && (
                    <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-brand-ink text-xs">
                      {t("operator:versionLatest")}
                    </span>
                  )}
                  {v.takedownReason !== null && (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive text-xs">
                      {t("operator:versionTakenDown")}
                    </span>
                  )}
                  {v.deprecated !== null && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                      {t("operator:versionDeprecated")}
                    </span>
                  )}
                  {v.yanked && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                      {t("operator:versionYanked")}
                    </span>
                  )}
                  <div className="flex-1" />
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {formatBytes(v.size)}
                  </span>
                  <span className="w-24 shrink-0 text-right text-muted-foreground text-xs">
                    {date(v.publishedAt)}
                  </span>
                  <TakedownControls
                    subject={`${pkg.name}@${v.version}`}
                    takenDown={v.takedownReason !== null}
                    busy={busy === v.version}
                    onTakedown={(reason) => onAct(v.version, "takedown", reason)}
                    onRestore={() => onAct(v.version, "restore")}
                  />
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}
