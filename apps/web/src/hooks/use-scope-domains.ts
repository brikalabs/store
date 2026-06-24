import { useCallback, useEffect, useState } from "react";
import { readError, scopePath } from "@/lib/scope-api";

export interface ScopeDomain {
  domain: string;
  verified: boolean;
  host: string;
  txt: string;
}

/**
 * The verified-domains data for a scope (ORG-010): load the list and claim/verify/remove a domain, so
 * the card stays presentational. Each mutation reloads on success and reports a failure through
 * `onError`; `add`/`verify`/`remove` resolve to whether the call succeeded (the form clears on a claim).
 */
export function useScopeDomains(scope: string, onError: (message: string) => void) {
  const [domains, setDomains] = useState<ScopeDomain[] | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(scopePath(scope, "/domains"));
    if (res.ok) {
      const data: { domains: ScopeDomain[] } = await res.json();
      setDomains(data.domains);
    }
  }, [scope]);
  useEffect(() => {
    void reload();
  }, [reload]);

  // PUT claims, POST verifies, DELETE removes - all carry `{ domain }` in the body.
  const mutate = useCallback(
    async (method: string, domain: string): Promise<boolean> => {
      setBusy(true);
      const res = await fetch(scopePath(scope, "/domains"), {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      setBusy(false);
      if (res.ok) {
        await reload();
        return true;
      }
      onError(await readError(res));
      return false;
    },
    [scope, reload, onError],
  );

  return {
    domains,
    busy,
    add: (domain: string) => mutate("PUT", domain),
    verify: (domain: string) => mutate("POST", domain),
    remove: (domain: string) => mutate("DELETE", domain),
  };
}
