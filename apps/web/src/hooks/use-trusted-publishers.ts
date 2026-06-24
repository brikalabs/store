import { useCallback, useEffect, useState } from "react";
import { readError, scopePath } from "@/lib/scope-api";

export interface TrustedPublisher {
  provider: string;
  repository: string;
  workflow: string;
}

/**
 * The trusted-publisher bindings for a scope (PUB-016): load the repos + workflows authorized to
 * publish via tokenless OIDC, and add/remove them, so the card stays presentational. Each mutation
 * reloads on success and reports a failure through `onError`; `add`/`remove` resolve to whether the
 * call succeeded (the form clears its inputs on a successful add).
 */
export function useTrustedPublishers(scope: string, onError: (message: string) => void) {
  const [bindings, setBindings] = useState<TrustedPublisher[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(scopePath(scope, "/trusted-publishers"));
    if (res.ok) {
      const data: { publishers: TrustedPublisher[] } = await res.json();
      setBindings(data.publishers);
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);

  // PUT authorizes a binding, DELETE revokes it - both carry the full `{ provider, repository, workflow }`.
  const mutate = useCallback(
    async (method: "PUT" | "DELETE", body: TrustedPublisher): Promise<boolean> => {
      setBusy(true);
      const res = await fetch(scopePath(scope, "/trusted-publishers"), {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setBusy(false);
      if (res.ok) {
        await load();
        return true;
      }
      onError(await readError(res));
      return false;
    },
    [scope, load, onError],
  );

  return {
    bindings,
    busy,
    add: (binding: TrustedPublisher) => mutate("PUT", binding),
    remove: (binding: TrustedPublisher) => mutate("DELETE", binding),
  };
}
