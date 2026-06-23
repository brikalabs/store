import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OperatorReportsPage } from "@/components/operator/operator-reports-page";
import { REPORT_REASON_KEYS } from "@/lib/reports";

/** URL state for the queue: page + filters, so a filtered view is shareable and survives refresh. */
const reportSearch = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q: z.string().optional().catch(undefined),
  reason: z.enum(REPORT_REASON_KEYS).optional().catch(undefined),
  status: z.enum(["open", "resolved", "dismissed", "all"]).catch("open"),
});

export const Route = createFileRoute("/operator/reports")({
  validateSearch: (input) => reportSearch.parse(input),
  component: OperatorReportsPage,
});
