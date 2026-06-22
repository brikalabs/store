import type { DnsResolver } from "@brika/registry-core";

/**
 * {@link DnsResolver} over DNS-over-HTTPS (Workers cannot open raw DNS sockets). Per the port
 * contract, returns `[]` only when the lookup SUCCEEDED with no matching record and THROWS on any
 * transport failure - so the re-verification cron can tell "TXT removed" (revoke) from "DNS hiccup" (skip).
 */
export class CloudflareDohResolver implements DnsResolver {
  readonly #endpoint: string;

  constructor(endpoint = "https://cloudflare-dns.com/dns-query") {
    this.#endpoint = endpoint;
  }

  async txt(hostname: string): Promise<string[]> {
    const url = `${this.#endpoint}?name=${encodeURIComponent(hostname)}&type=TXT`;
    const res = await fetch(url, { headers: { accept: "application/dns-json" } });
    if (!res.ok) throw new Error(`DoH lookup for ${hostname} failed: HTTP ${res.status}`);
    const body: { Answer?: { type: number; data: string }[] } = await res.json();
    // TXT is record type 16; DoH quotes the value (chunked strings as adjacent quoted segments),
    // so strip the surrounding double quotes. A 200 with no Answer is a definitive "no record" -> [].
    return (body.Answer ?? [])
      .filter((answer) => answer.type === 16)
      .map((answer) => answer.data.replace(/^"|"$/g, "").replaceAll('""', ""));
  }
}
