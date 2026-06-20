import type { DnsResolver } from "@brika/registry-core";

/**
 * {@link DnsResolver} over DNS-over-HTTPS, shared by both Workers (Cloudflare Workers
 * cannot open raw DNS sockets, so org domain verification resolves TXT records via the
 * public DoH JSON endpoint). Failures (network, NXDOMAIN, malformed response) resolve to
 * `[]` so a missing record reads as "not yet verified" rather than throwing. Not a D1
 * adapter, but lives here as the one shared implementation of a registry-core port.
 */
export class CloudflareDohResolver implements DnsResolver {
  readonly #endpoint: string;

  constructor(endpoint = "https://cloudflare-dns.com/dns-query") {
    this.#endpoint = endpoint;
  }

  async txt(hostname: string): Promise<string[]> {
    try {
      const url = `${this.#endpoint}?name=${encodeURIComponent(hostname)}&type=TXT`;
      const res = await fetch(url, { headers: { accept: "application/dns-json" } });
      if (!res.ok) return [];
      const body = (await res.json()) as { Answer?: { type: number; data: string }[] };
      // TXT is record type 16; DoH returns the value quoted (chunked strings as adjacent
      // quoted segments), so strip the surrounding double quotes.
      return (body.Answer ?? [])
        .filter((answer) => answer.type === 16)
        .map((answer) => answer.data.replace(/^"|"$/g, "").replaceAll('""', ""));
    } catch {
      return [];
    }
  }
}
