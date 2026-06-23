import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OperatorAuditPage } from "@/components/operator/operator-audit-page";

const auditSearch = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  action: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/operator/audit")({
  validateSearch: (input) => auditSearch.parse(input),
  component: OperatorAuditPage,
});
