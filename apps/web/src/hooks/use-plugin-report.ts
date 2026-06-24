import { useCallback, useState } from "react";
import type { ReportReason } from "@/lib/reports";

/**
 * The submit flow for the "Report this plugin" dialog: POST the report and own the in-flight,
 * error, and submitted state so the dialog stays presentational. `submit` resolves to whether the
 * report was filed (the dialog swaps to its success panel on a true result); `reset` clears the
 * flow so the next open starts fresh.
 */
export function usePluginReport(name: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submit = useCallback(
    async (reason: ReportReason, details: string): Promise<boolean> => {
      setSubmitting(true);
      setError(null);
      const res = await fetch(`/v1/plugins/${encodeURIComponent(name)}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      setSubmitting(false);
      if (res.status === 401) {
        setError("Please sign in to report this plugin.");
        return false;
      }
      if (!res.ok) {
        setError("Could not submit your report. Please try again.");
        return false;
      }
      setSubmitted(true);
      return true;
    },
    [name],
  );

  const reset = useCallback(() => {
    setError(null);
    setSubmitted(false);
  }, []);

  return { submitting, error, submitted, submit, reset };
}
