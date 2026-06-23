/**
 * The plugin-report reason taxonomy, shared by the report modal, the POST input schema, and the
 * operator queue so the categories and copy stay in one place. Keys are stored in `reports.reason`.
 */
export const REPORT_REASONS = {
  security: {
    label: "Malware or security risk",
    description: "Steals data, runs unexpected code, or ships a known vulnerability.",
  },
  spam: {
    label: "Spam or typosquatting",
    description: "Misleading name, impersonates another package, or low-quality spam.",
  },
  impersonation: {
    label: "Impersonation or trademark",
    description: "Uses a brand or author identity it has no right to.",
  },
  broken: {
    label: "Broken or misleading behavior",
    description: "Does something materially different from what it claims.",
  },
  dmca: {
    label: "Copyright / DMCA",
    description: "Includes code or assets that infringe copyright.",
  },
  other: {
    label: "Something else",
    description: "Anything the categories above do not cover.",
  },
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export const REPORT_REASON_KEYS: [ReportReason, ...ReportReason[]] = [
  "security",
  "spam",
  "impersonation",
  "broken",
  "dmca",
  "other",
];

/** Narrow an arbitrary string to a known reason key. */
function isReportReason(key: string): key is ReportReason {
  return key in REPORT_REASONS;
}

/** Human label for a stored reason key, falling back to the raw key for anything unrecognized. */
export function reportReasonLabel(key: string): string {
  return isReportReason(key) ? REPORT_REASONS[key].label : key;
}
