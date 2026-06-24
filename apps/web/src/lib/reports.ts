import type { AppKey } from "@/i18n";

/**
 * The plugin-report reason taxonomy, shared by the report modal, the POST input schema, and the
 * operator queue. The codes are the stable contract (stored in `reports.reason`); the human label and
 * description live in the `reports` i18n namespace, resolved at render via `useT`.
 */
export const REPORT_REASON_KEYS = [
  "security",
  "spam",
  "impersonation",
  "broken",
  "dmca",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASON_KEYS)[number];

/** Narrow an arbitrary string to a known reason code. */
export function isReportReason(key: string): key is ReportReason {
  return REPORT_REASON_KEYS.some((reason) => reason === key);
}

/** i18n key for a reason's short label, falling back to the generic "other" label for unknown codes. */
export function reportReasonLabelKey(key: string): AppKey {
  return isReportReason(key) ? `reports:${key}Label` : "reports:otherLabel";
}

/** i18n key for a reason's longer description. */
export function reportReasonDescriptionKey(reason: ReportReason): AppKey {
  return `reports:${reason}Description`;
}
