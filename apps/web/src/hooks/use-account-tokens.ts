import { useCallback, useEffect, useState } from "react";

export interface Token {
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number | null;
}

/**
 * The API tokens for the signed-in account: load the list and create/revoke a token, so the page
 * stays presentational. The list reloads after a successful mutation. `create` resolves to the
 * freshly minted secret (shown once) or `null` on failure; the secret is also kept in `fresh` so the
 * page can surface the one-time copy banner. Failures are silently ignored, matching the prior page.
 */
export function useAccountTokens() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/tokens");
    if (res.ok) {
      const data: { tokens: Token[] } = await res.json();
      setTokens(data.tokens);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    setBusy(true);
    const res = await fetch("/api/account/tokens", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const data: { token: string } = await res.json();
      setFresh(data.token);
      await load();
    }
  }, [load]);

  const revoke = useCallback(
    async (hash: string) => {
      const res = await fetch(`/api/account/tokens/${encodeURIComponent(hash)}`, {
        method: "DELETE",
      });
      if (res.ok) await load();
    },
    [load],
  );

  return { tokens, fresh, busy, create, revoke };
}
