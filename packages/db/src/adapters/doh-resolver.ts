import type { DnsResolver } from "@brika/registry-core";

/**
 * {@link DnsResolver} over DNS-over-HTTPS, shared by both Workers (Cloudflare Workers
 * cannot open raw DNS sockets, so org domain verification resolves TXT records via the
 * public DoH JSON endpoint). Per the port contract it returns `[]` only when the lookup
 * SUCCEEDED with no matching record, and THROWS on a transport failure (network error,
 * non-OK response, malformed body) - so the re-verification cron can tell "TXT removed"
 * (revoke) from "DNS hiccup" (skip) apart. Interactive verify wraps this and treats a
 * throw as "not yet verified". Not a D1 adapter, but the one shared port implementation.
 */
export class CloudflareDohResolver implements DnsResolver {
  readonly #endpoint: string;

  constructor(endpoint = "https://cloudflare-dns.com/dns-query") {
    this.#endpoint = endpoint;
  }

  async txt(hostname: string): Promise<string[]> {
    const url = `${this.#endpoint}?name=${encodeURIComponent(hostname)}&type=TXT`;
    // A network failure rejects here and propagates (a transport error, not "no record").
    const res = await fetch(url, { headers: { accept: "application/dns-json" } });
    if (!res.ok) throw new Error(`DoH lookup for ${hostname} failed: HTTP ${res.status}`);
    const body = (await res.json()) as { Answer?: { type: number; data: string }[] };
    // TXT is record type 16; DoH returns the value quoted (chunked strings as adjacent
    // quoted segments), so strip the surrounding double quotes. A 200 with no Answer is a
    // definitive "no record" -> [].
    return (body.Answer ?? [])
      .filter((answer) => answer.type === 16)
      .map((answer) => answer.data.replace(/^"|"$/g, "").replaceAll('""', ""));
  }
}
