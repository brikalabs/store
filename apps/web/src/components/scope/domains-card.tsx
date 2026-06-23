import { Button, Input } from "@brika/clay";
import { Check, Copy, Globe, Plus, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Pill } from "@/components/clay/pill";
import { SettingsCard } from "@/components/clay/settings-card";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

interface DomainRow {
  domain: string;
  verified: boolean;
  host: string;
  txt: string;
}

/** A bordered TXT-row with a label, a mono value, and a copy button (shows a check briefly). */
function TxtRow({
  label,
  value,
  copyable,
  last,
}: Readonly<{ label: string; value: string; copyable?: boolean; last?: boolean }>) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={`grid grid-cols-[64px_1fr_34px] items-center gap-2 px-3 py-2.5${
        last ? "" : " border-border border-b"
      }`}
    >
      <span className="font-bold text-[10.5px] text-muted-foreground uppercase tracking-[0.05em]">
        {label}
      </span>
      <span className="truncate font-mono text-[12.5px] text-foreground">{value}</span>
      {copyable ? (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          title="Copy"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="flex size-[30px] items-center justify-center rounded-lg border border-input bg-card text-muted-foreground shadow-none hover:border-brand-border hover:bg-card hover:text-brand-ink"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

/** Claim + DNS-verify domains (ORG-010): add, show the TXT challenge, verify, remove. */
export function DomainsCard({ scope, onError }: Readonly<ScopeCardProps>) {
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(scopePath(scope, "/domains"));
    if (res.ok) {
      const data: { domains: DomainRow[] } = await res.json();
      setDomains(data.domains);
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);

  // PUT claims, POST verifies, DELETE removes - all carry `{ domain }` in the body.
  async function call(method: string, domain: string) {
    setBusy(true);
    const res = await fetch(scopePath(scope, "/domains"), {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    setBusy(false);
    if (res.ok) {
      if (method === "PUT") setInput("");
      await load();
    } else {
      onError(await readError(res));
    }
  }

  return (
    <SettingsCard className="gap-1.5">
      <h2 className="font-bold text-base text-foreground">Verified domains</h2>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        Prove your scope controls a domain via a TXT record, then verify. Verified domains show a
        badge on your public scope page.
      </p>
      {domains === null ? (
        <div className="mt-2 h-12 animate-pulse rounded-[11px] bg-muted" />
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5">
          {domains.map((d) =>
            d.verified ? (
              <li
                key={d.domain}
                className="flex items-center gap-2.5 rounded-[11px] border border-border bg-muted px-3.5 py-2.5"
              >
                <Globe className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate font-mono text-[13.5px] text-foreground">
                  {d.domain}
                </span>
                <Pill
                  tone="success"
                  className="gap-1 py-[3px] font-bold text-[11.5px] [&>svg]:size-3.5"
                >
                  <Check className="size-3.5" />
                  Verified
                </Pill>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${d.domain}`}
                  disabled={busy}
                  onClick={() => call("DELETE", d.domain)}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-danger"
                >
                  <X className="size-4" />
                </Button>
              </li>
            ) : (
              <li
                key={d.domain}
                className="overflow-hidden rounded-[13px] border border-warning-border"
              >
                <div className="flex items-center gap-2.5 bg-warning-tint px-3.5 py-2.5">
                  <Globe className="size-4 text-warning" />
                  <span className="flex-1 truncate font-mono text-[13.5px] text-foreground">
                    {d.domain}
                  </span>
                  <Pill tone="warning" dot className="bg-card py-[3px] font-bold text-[11.5px]">
                    Pending
                  </Pill>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${d.domain}`}
                    disabled={busy}
                    onClick={() => call("DELETE", d.domain)}
                    className="flex size-7 items-center justify-center rounded-lg text-warning hover:bg-card"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="bg-card p-3.5">
                  <p className="mb-2.5 text-muted-foreground text-xs leading-relaxed">
                    Add this <span className="font-mono text-foreground">TXT</span> record at your
                    DNS provider, then verify. Propagation can take a few minutes.
                  </p>
                  <div className="overflow-hidden rounded-[11px] border border-border bg-muted">
                    <TxtRow label="Type" value="TXT" />
                    <TxtRow label="Name" value={d.host} copyable />
                    <TxtRow label="Value" value={d.txt} copyable last />
                  </div>
                  <div className="mt-3 flex gap-2.5">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => call("POST", d.domain)}
                      className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-brand px-4 font-bold text-brand-foreground text-sm hover:bg-brand hover:brightness-105 disabled:opacity-60"
                    >
                      <ShieldCheck className="size-3.5" />
                      Verify
                    </Button>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void call("PUT", input.trim().toLowerCase());
        }}
        className="mt-2 flex flex-col gap-2.5 sm:flex-row"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value.toLowerCase())}
          placeholder="add-a-domain.com"
          aria-label="Domain to claim"
          className="flex-1 rounded-[10px] border-input bg-muted font-mono"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={busy || input.trim().length < 3}
          className="h-10 rounded-[10px] border border-input bg-card px-4 font-semibold text-foreground shadow-none hover:border-brand-border hover:bg-card hover:brightness-100"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </form>
    </SettingsCard>
  );
}
