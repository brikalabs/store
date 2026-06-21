import { createFileRoute } from "@tanstack/react-router";
import { OperatorAuditPage } from "@/components/operator/operator-audit-page";

export const Route = createFileRoute("/operator/audit")({
  component: OperatorAuditPage,
});
