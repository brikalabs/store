import { afterEach, describe, expect, test } from "bun:test";
import { CloudflareDohResolver } from "./doh-resolver";

/** The DoH resolver is pure transport over `fetch`, so the tests stub `fetch`. */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(impl: () => Response | Promise<Response>) {
  globalThis.fetch = (() => Promise.resolve(impl())) as typeof fetch;
}

function dnsJson(answers: { type: number; data: string }[]): Response {
  return new Response(JSON.stringify({ Answer: answers }), { status: 200 });
}

describe("CloudflareDohResolver.txt", () => {
  test("returns TXT (type 16) values, stripping the surrounding quotes", async () => {
    stubFetch(() =>
      dnsJson([
        { type: 16, data: '"brika-verify=abc"' },
        { type: 5, data: "ignored.cname." }, // non-TXT record is filtered out
      ]),
    );
    expect(await new CloudflareDohResolver().txt("_brika-challenge.acme.dev")).toEqual([
      "brika-verify=abc",
    ]);
  });

  test("returns [] on a definitive empty answer (lookup succeeded, no records)", async () => {
    stubFetch(() => new Response(JSON.stringify({}), { status: 200 }));
    expect(await new CloudflareDohResolver().txt("acme.dev")).toEqual([]);
  });

  test("THROWS on a non-OK response (transport failure, so the cron skips not revokes)", async () => {
    stubFetch(() => new Response("nope", { status: 502 }));
    expect(new CloudflareDohResolver().txt("acme.dev")).rejects.toThrow();
  });

  test("propagates a transport throw (network error)", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("network down"))) as typeof fetch;
    expect(new CloudflareDohResolver().txt("acme.dev")).rejects.toThrow("network down");
  });
});
