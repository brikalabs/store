import { useCallback, useState } from "react";
import { withSeparator } from "@/lib/device-code";

/** Outcome of the device-approval POST: untouched, authorized, or rejected. */
export type DeviceApprovalState = "idle" | "ok" | "error";

/**
 * The device-authorization mutation (DEV-001): POST the entered user code to `/api/device/approve`
 * so the page stays presentational. Tracks the in-flight flag and the outcome; the code is rejoined
 * with its separator on the way out, since the OTP holds the 8 characters without the hyphen.
 */
export function useDeviceApproval() {
  const [state, setState] = useState<DeviceApprovalState>("idle");
  const [submitting, setSubmitting] = useState(false);

  const approve = useCallback(async (userCode: string) => {
    setSubmitting(true);
    setState("idle");
    const res = await fetch("/api/device/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_code: withSeparator(userCode) }),
    });
    setSubmitting(false);
    setState(res.ok ? "ok" : "error");
  }, []);

  return { state, submitting, approve };
}
