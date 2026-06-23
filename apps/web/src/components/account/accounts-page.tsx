import { Button } from "@brika/clay";
import { getRouteApi } from "@tanstack/react-router";
import { Check, Link2, Loader2, Unlink } from "lucide-react";
import { type ComponentType, useCallback, useEffect, useState } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { Pill } from "@/components/clay/pill";
import { SettingsCard } from "@/components/clay/settings-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { ErrorBanner } from "@/components/layout/error-banner";
import { linkSocial, listAccounts, unlinkAccount } from "@/lib/auth/client";

/** A social provider on the connected-accounts surface (USER-004); `id` matches `listAccounts()`. */
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

  // Gates the last-provider unlink guard (USER-004-AC4); BetterAuth also refuses
  // server-side, so this is defense in depth + a clear disabled affordance.
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
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          Connected accounts
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          The sign-in providers linked to your Brika account. Link another to sign in more ways; you
          can unlink any provider as long as one sign-in method remains.
        </p>
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {accounts === null ? (
        <div className="h-40 animate-pulse rounded-[18px] bg-muted" />
      ) : (
        <div className="flex flex-col gap-4">
          <SettingsCard className="overflow-hidden p-0">
            {PROVIDERS.map((provider) => {
              const connected = accounts.some((a) => a.providerId === provider.id);
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
          </SettingsCard>

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

/** One provider row: its connected state and the link/unlink action. */
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
    <div className="flex flex-wrap items-center gap-3.5 px-5 py-[18px] [&:not(:last-child)]:border-border [&:not(:last-child)]:border-b">
      <span className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
        <provider.Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-[14.5px] text-foreground">{provider.label}</div>
        <div className="text-[12.5px] text-muted-foreground">
          Link to sign in and to verify ownership when publishing.
        </div>
      </div>
      {connected ? (
        <div className="flex items-center gap-2.5">
          <Pill tone="success" className="font-bold text-[12px]">
            <Check className="size-3.5" />
            Connected
          </Pill>
          <Button
            type="button"
            variant="outline"
            disabled={busy || isLastLinked}
            className="border-input hover:border-danger-border hover:text-danger"
            title={
              isLastLinked
                ? "You can't unlink your only sign-in method."
                : `Disconnect ${provider.label}`
            }
            onClick={onUnlink}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="border-input hover:border-brand-border"
          onClick={onLink}
          title={`Connect ${provider.label}`}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Connect
        </Button>
      )}
    </div>
  );
}
