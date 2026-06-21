import { Button } from "@brika/clay";
import { getRouteApi } from "@tanstack/react-router";
import { Check, Link2, Loader2, Unlink } from "lucide-react";
import { type ComponentType, useCallback, useEffect, useState } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { AdminShell } from "@/components/layout/admin-shell";
import { linkSocial, listAccounts, unlinkAccount } from "@/lib/auth/client";

/**
 * Provider registry for the connected-accounts surface (USER-004). Each entry is a
 * social provider BetterAuth is (or will be) configured with. Adding a second
 * provider is a one-line addition here plus its `socialProviders` config in
 * `server/auth.ts` - the link/unlink plumbing below is provider-agnostic. The
 * `providerId` matches what `listAccounts()` returns and what `linkSocial`/
 * `unlinkAccount` expect.
 */
type Provider = {
  id: "github";
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const PROVIDERS: readonly Provider[] = [{ id: "github", label: "GitHub", Icon: GithubIcon }];

/** Where BetterAuth returns the user after the OAuth link round-trip lands. */
const LINK_CALLBACK = "/dashboard/accounts";

/** A linked provider identity as returned by `listAccounts()`. */
interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

const route = getRouteApi("/dashboard/accounts");

export function AccountsPage() {
  const { user } = route.useRouteContext();
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listAccounts();
    if (res.error) {
      setError(res.error.message ?? "Could not load connected accounts.");
      setAccounts([]);
      return;
    }
    setError(null);
    setAccounts(
      (res.data ?? []).map((a) => ({
        id: a.id,
        providerId: a.providerId,
        accountId: a.accountId,
      })),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Linked count of the providers we surface; gates the last-provider unlink guard
  // (USER-004-AC4). BetterAuth also refuses unlinking the last account server-side,
  // so this is defense in depth + a clear disabled affordance, not the only check.
  const linkedCount = accounts?.filter((a) => a.providerId !== "credential").length ?? 0;

  async function link(provider: Provider["id"]) {
    setBusy(provider);
    setError(null);
    // Full-page OAuth redirect; the browser leaves and returns to LINK_CALLBACK.
    const res = await linkSocial({ provider, callbackURL: LINK_CALLBACK });
    if (res.error) {
      setError(res.error.message ?? `Could not start linking ${provider}.`);
      setBusy(null);
    }
  }

  async function unlink(providerId: string) {
    setBusy(providerId);
    setError(null);
    const res = await unlinkAccount({ providerId });
    setBusy(null);
    if (res.error) {
      setError(res.error.message ?? "Could not unlink this provider.");
      return;
    }
    await load();
  }

  return (
    <AdminShell
      id={user.id}
      name={user.name}
      avatarUrl={user.avatarUrl}
      activeLabel="Connected accounts"
    >
      <div>
        <h1 className="font-bold font-heading text-2xl tracking-tight">Connected accounts</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          The sign-in providers linked to your Brika account. Link another to sign in more ways; you
          can unlink any provider as long as one sign-in method remains.
        </p>
      </div>

      {error === null ? null : (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {accounts === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <div className="flex flex-col gap-3">
          {PROVIDERS.map((provider) => {
            const connected = accounts.find((a) => a.providerId === provider.id) !== undefined;
            return (
              <AccountRow
                key={provider.id}
                provider={provider}
                connected={connected}
                busy={busy === provider.id}
                // Can't remove the only remaining sign-in method (USER-004-AC4).
                isLastLinked={connected && linkedCount <= 1}
                onLink={() => link(provider.id)}
                onUnlink={() => unlink(provider.id)}
              />
            );
          })}

          <p className="px-1 text-muted-foreground text-xs">
            More sign-in providers are coming. When a provider is added, it appears here ready to
            link, and any account linked by a trusted provider's verified email resolves to this
            same Brika account.
          </p>
        </div>
      )}
    </AdminShell>
  );
}

/** One provider row: its connected state and the link/unlink action. Extracted so the list callback
 *  stays trivial and this stays well under the cognitive-complexity budget. */
function AccountRow({
  provider,
  connected,
  busy,
  isLastLinked,
  onLink,
  onUnlink,
}: Readonly<{
  provider: Provider;
  connected: boolean;
  busy: boolean;
  isLastLinked: boolean;
  onLink: () => void;
  onUnlink: () => void;
}>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-muted">
          <provider.Icon className="size-5" />
        </span>
        <div>
          <div className="font-semibold text-foreground text-sm">{provider.label}</div>
          <div className="text-muted-foreground text-xs">
            {connected ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3.5 text-brand-ink" />
                Connected
              </span>
            ) : (
              "Not connected"
            )}
          </div>
        </div>
      </div>
      {connected ? (
        <Button
          type="button"
          variant="secondary"
          disabled={busy || isLastLinked}
          title={
            isLastLinked ? "You can't unlink your only sign-in method." : `Unlink ${provider.label}`
          }
          onClick={onUnlink}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
          Unlink
        </Button>
      ) : (
        <Button type="button" disabled={busy} onClick={onLink} title={`Link ${provider.label}`}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Link
        </Button>
      )}
    </div>
  );
}
