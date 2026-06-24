import { Button } from "@brika/clay";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@brika/clay/components/input-group";
import type { Translate } from "@brika/i18n";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Check, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Pager } from "@/components/clay/pagination";
import { GradientAvatar, PluginIcon } from "@/components/clay/plugin-icon";
import { OperatorShell } from "@/components/operator/operator-shell";
import {
  type Facet,
  FacetChips,
  OperatorHeader,
  SortSelect,
} from "@/components/operator/operator-toolbar";
import { type OperatorReport, useOperatorReports } from "@/hooks/use-operator-reports";
import { type AppKey, useRelativeTime, useT } from "@/i18n";
import { REPORT_REASON_KEYS, reportReasonLabelKey } from "@/lib/reports";

const route = getRouteApi("/operator/reports");

type StatusKey = "open" | "resolved" | "dismissed" | "all";
type AppTranslate = Translate<AppKey>;

/** Localized label for a report's settled status; unknown values fall back to the raw key. */
function statusLabel(status: string, t: AppTranslate): string {
  if (status === "resolved") return t("operator:reportStatusResolved");
  if (status === "dismissed") return t("operator:reportStatusDismissed");
  return status;
}

/** One report row: plugin, reason/status badges, details, reporter, and the open-report actions. */
function ReportRow({
  report,
  busy,
  onAct,
}: Readonly<{
  report: OperatorReport;
  busy: boolean;
  onAct: (status: "resolved" | "dismissed") => void;
}>) {
  const t = useT();
  const relative = useRelativeTime();
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start">
      <PluginIcon name={report.pluginName} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/$"
            params={{ _splat: report.pluginName }}
            className="truncate font-medium font-mono text-sm hover:underline"
          >
            {report.pluginName}
          </Link>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
            {t(reportReasonLabelKey(report.reason))}
          </span>
          {report.status !== "open" && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs capitalize">
              {statusLabel(report.status, t)}
            </span>
          )}
        </div>
        {report.details !== null && report.details.length > 0 ? (
          <p className="text-foreground text-sm leading-relaxed">{report.details}</p>
        ) : (
          <p className="text-muted-foreground text-sm italic">{t("operator:reportsNoDetails")}</p>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <GradientAvatar
            seed={report.reporter.id}
            label={report.reporter.displayName}
            imageUrl={report.reporter.avatarUrl}
            size={18}
            round
          />
          <span>{report.reporter.displayName}</span>
          <span aria-hidden>·</span>
          <span>{relative(report.createdAt)}</span>
        </div>
      </div>
      {report.status === "open" && (
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onAct("dismissed")}>
            <X className="size-4" />
            {t("operator:reportDismiss")}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onAct("resolved")}>
            <Check className="size-4" />
            {t("operator:reportResolve")}
          </Button>
        </div>
      )}
    </li>
  );
}

export function OperatorReportsPage() {
  const t = useT();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data, busy, error, act } = useOperatorReports(search);
  const [text, setText] = useState(search.q ?? "");

  // Keep the box in sync when the URL `q` changes from outside (back/forward, cleared filters).
  useEffect(() => setText(search.q ?? ""), [search.q]);

  // Debounce the search box into the URL, returning to page 1 on a new query.
  useEffect(() => {
    const next = text.trim() || undefined;
    if (next === (search.q ?? undefined)) return;
    const id = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, q: next, page: 1 }) });
    }, 300);
    return () => clearTimeout(id);
  }, [text, search.q, navigate]);

  const counts = data?.counts;
  const statusFacets: Facet<StatusKey>[] = [
    { key: "open", label: t("operator:reportsFacetOpen"), count: counts?.open ?? 0 },
    { key: "resolved", label: t("operator:reportsFacetResolved"), count: counts?.resolved ?? 0 },
    { key: "dismissed", label: t("operator:reportsFacetDismissed"), count: counts?.dismissed ?? 0 },
    {
      key: "all",
      label: t("operator:reportsFacetAll"),
      count: counts ? counts.open + counts.resolved + counts.dismissed : 0,
    },
  ];

  const filtered =
    search.q !== undefined || search.reason !== undefined || search.status !== "open";

  function renderBody() {
    if (data === null)
      return <p className="text-muted-foreground text-sm">{t("operator:loading")}</p>;
    if (data.items.length === 0) {
      return (
        <p className="text-muted-foreground text-sm">
          {filtered ? t("operator:reportsEmptyFiltered") : t("operator:reportsEmptyOpen")}
        </p>
      );
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {data.items.map((report) => (
          <ReportRow
            key={report.id}
            report={report}
            busy={busy === report.id}
            onAct={(status) => act(report.id, status)}
          />
        ))}
      </ul>
    );
  }

  return (
    <OperatorShell activeLabel="reports">
      <OperatorHeader title={t("operator:reportsTitle")}>
        {t("operator:reportsIntro")}
      </OperatorHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FacetChips
          facets={statusFacets}
          active={search.status}
          onSelect={(status) => navigate({ search: (prev) => ({ ...prev, status, page: 1 }) })}
        />
        <SortSelect
          label={t("operator:reportsReasonLabel")}
          value={search.reason ?? "all"}
          options={[
            { value: "all", label: t("operator:reportsAllReasons") },
            ...REPORT_REASON_KEYS.map((key) => ({
              value: key,
              label: t(reportReasonLabelKey(key)),
            })),
          ]}
          onChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                reason: REPORT_REASON_KEYS.find((key) => key === value),
                page: 1,
              }),
            })
          }
        />
      </div>

      <InputGroup className="max-w-sm">
        <InputGroupAddon align="inline-start">
          <Search className="size-4 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("operator:reportsSearchPlaceholder")}
        />
      </InputGroup>

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      {renderBody()}

      {data && (
        <Pager
          pagination={data.pagination}
          onPageChange={(page) => navigate({ search: (prev) => ({ ...prev, page }) })}
        />
      )}
    </OperatorShell>
  );
}
