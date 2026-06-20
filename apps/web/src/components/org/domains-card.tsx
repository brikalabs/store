import { Button, Input } from "@brika/clay";
import { Check, Globe, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type OrgCardProps, orgPath, readError } from "../../lib/org-api";

interface DomainRow {
  domain: string;
  verified: boolean;
  host: string;
  txt: string;
}

/** Claim + DNS-verify domains (ORG-010): add, show the TXT challenge, verify, remove. */
export function DomainsCard({ org, onError }: Readonly<OrgCardProps>) {
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(orgPath(org, "/domains"));
    if (res.ok) {
      const data: { domains: DomainRow[] } = await res.json();
      setDomains(data.domains);
    }
  }, [org]);
  useEffect(() => {
    void load();
  }, [load]);

  // PUT claims, POST verifies, DELETE removes - all carry `{ domain }` in the body.
  async function call(method: string, domain: string) {
    setBusy(true);
    const res = await fetch(orgPath(org, "/domains"), {
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
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-bold font-heading text-lg tracking-tight">Verified domains</h2>
      <p className="text-muted-foreground text-sm">
        Prove your org controls a domain by adding a TXT record, then verifying. Verified domains
        show a badge on your public org page.
      </p>
      {domains === null ? (
        <div className="h-12 animate-pulse rounded-xl bg-muted" />
      ) : (
        <ul className="flex flex-col gap-3">
          {domains.map((d) => (
            <li key={d.domain} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <span className="flex-1 font-mono font-semibold text-sm">{d.domain}</span>
                {d.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 font-semibold text-brand-ink text-xs">
                    <Check className="size-3.5" />
                    Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => call("POST", d.domain)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium text-sm transition-colors hover:bg-muted"
                  >
                    <ShieldCheck className="size-3.5" />
                    Verify
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${d.domain}`}
                  disabled={busy}
                  onClick={() => call("DELETE", d.domain)}
                  className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {!d.verified && (
                <div className="flex flex-col gap-1 text-muted-foreground text-xs">
                  <span>Add this DNS TXT record, then click Verify:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>host</span>
                    <code className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                      {d.host}
                    </code>
                    <span>value</span>
                    <code className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                      {d.txt}
                    </code>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void call("PUT", input.trim().toLowerCase());
        }}
        className="flex flex-col gap-2 border-border border-t pt-4 sm:flex-row"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value.toLowerCase())}
          placeholder="brika.dev"
          aria-label="Domain to claim"
          className="font-mono"
        />
        <Button type="submit" disabled={busy || input.trim().length < 3}>
          <Plus className="size-4" />
          Add domain
        </Button>
      </form>
    </section>
  );
}
