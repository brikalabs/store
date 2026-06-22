import { beforeEach, describe, expect, mock, test } from "bun:test";
import { type Provider, runInContext } from "@brika/di";
import { DnsResolver, DomainChallenge } from "@brika/registry-core";
import { HttpError } from "@brika/router";
import type { Db } from "@brika/store-db";
import { issueToken } from "@brika/store-db/adapters";
import { provideRegistry } from "../services";
import { fakeR2, makeDb } from "../test-harness";

/**
 * Controller tests for the scope profile/domain handlers (ORG-009/010): the thin HTTP layer
 * over `inject(ScopeService)`. Each handler runs inside an injection context built from the
 * in-memory graph (the `run` helper), the same seam `mount({ around })` establishes in
 * production. `cloudflare:workers` is stubbed (the publish/manage controllers transitively
 * import it); handlers are imported after the stub.
 */
mock.module("cloudflare:workers", () => ({ env: { STORE_URL: "http://localhost:3000/" } }));

const { createScope, getScope, setProfile, addDomain, listDomains, verifyDomain, deleteDomain } =
  await import("./scope");

async function statusOf(run: Promise<Response>): Promise<number> {
  try {
    return (await run).status;
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

function services(db: Db): Provider[] {
  return provideRegistry({ db, tarballs: fakeR2(), baseUrl: "http://localhost:8787" });
}

/**
 * Run a handler inside the per-request injection context the `mount({ around })` wrapper
 * would establish in production, so its `inject(...)` calls resolve. `extra` providers are
 * appended so a test can override one dependency with a mock (a later provider wins).
 */
function run<T>(providers: Provider[], fn: () => Promise<T>, extra: Provider[] = []): Promise<T> {
  return runInContext([...providers, ...extra], fn);
}

function post(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/", { method: "POST", headers, body: JSON.stringify(body) });
}

let db: Db;
beforeEach(() => {
  db = makeDb();
});

/** Claim `scope` as `login` (who becomes its admin) and return the admin's token. */
async function seedScopeAdmin(login: string, scope: string): Promise<string> {
  const token = await issueToken(db, login);
  await run(services(db), () => createScope({ params: { scope }, req: post(undefined, token) }));
  return token;
}

describe("getScope (public)", () => {
  test("200 with the scope's public fields (no sub-scopes); 404 for an unknown scope", async () => {
    await seedScopeAdmin("alice", "@acme");
    const ctx = services(db);
    const res = await run(ctx, () => getScope({ params: { scope: "@acme" } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, scope: "@acme", iconKey: null });
    // A scope no longer owns sub-scopes: the public payload exposes no `scopes` array.
    expect(body).not.toHaveProperty("scopes");
    expect(await statusOf(run(ctx, () => getScope({ params: { scope: "@nope" } })))).toBe(404);
  });
});

describe("setProfile (ORG-009)", () => {
  test("an admin sets description + links; a non-member is forbidden", async () => {
    const alice = await seedScopeAdmin("alice", "@acme");
    const body = {
      description: "We build things",
      links: [{ label: "X", url: "https://x.com/a" }],
    };
    const res = await run(services(db), () =>
      setProfile({ params: { scope: "@acme" }, body, req: post(body, alice) }),
    );
    expect(res.status).toBe(200);

    const bob = await issueToken(db, "bob");
    expect(
      await statusOf(
        run(services(db), () =>
          setProfile({
            params: { scope: "@acme" },
            body: { description: null, links: [] },
            req: post(undefined, bob),
          }),
        ),
      ),
    ).toBe(403);
  });
});

describe("domains (ORG-010)", () => {
  test("add returns the TXT host + value; list reflects it; a bad domain is 400; non-admin 403", async () => {
    const alice = await seedScopeAdmin("alice", "@acme");
    const add = await run(services(db), () =>
      addDomain({ params: { scope: "@acme", domain: "acme.dev" }, req: post(undefined, alice) }),
    );
    expect(add.status).toBe(201);
    const added = (await add.json()) as { host: string; txt: string };
    expect(added.host).toBe("_brika-challenge.acme.dev");
    expect(added.txt.length).toBeGreaterThan(0);

    const list = await run(services(db), () =>
      listDomains({ params: { scope: "@acme" }, req: post(undefined, alice) }),
    );
    const listed = (await list.json()) as { domains: { domain: string; host: string }[] };
    expect(listed.domains).toMatchObject([
      { domain: "acme.dev", host: "_brika-challenge.acme.dev" },
    ]);

    // A non-canonical domain is rejected at the controller (parseDomain -> 400).
    expect(
      await statusOf(
        run(services(db), () =>
          addDomain({
            params: { scope: "@acme", domain: "not a domain" },
            req: post(undefined, alice),
          }),
        ),
      ),
    ).toBe(400);

    const bob = await issueToken(db, "bob");
    expect(
      await statusOf(
        run(services(db), () =>
          addDomain({ params: { scope: "@acme", domain: "evil.dev" }, req: post(undefined, bob) }),
        ),
      ),
    ).toBe(403);
  });

  test("verify flips to verified when the challenge TXT resolves; delete removes (then 404)", async () => {
    // Deterministic challenge + a resolver that returns it. Override just these two ports; the
    // field-injected `ScopeService` resolves them from the (otherwise real) graph.
    const challenge: DomainChallenge = { token: () => Promise.resolve("TOK") };
    const dns: DnsResolver = { txt: () => Promise.resolve(["TOK"]) };
    const overrides: Provider[] = [
      { provide: DomainChallenge, useValue: challenge },
      { provide: DnsResolver, useValue: dns },
    ];
    const graph = services(db);
    const token = await issueToken(db, "alice");
    await run(
      graph,
      () => createScope({ params: { scope: "@acme" }, req: post(undefined, token) }),
      overrides,
    );
    await run(
      graph,
      () =>
        addDomain({ params: { scope: "@acme", domain: "acme.dev" }, req: post(undefined, token) }),
      overrides,
    );

    const verify = await run(
      graph,
      () =>
        verifyDomain({
          params: { scope: "@acme", domain: "acme.dev" },
          req: post(undefined, token),
        }),
      overrides,
    );
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({ verified: true });

    const del = await run(
      graph,
      () =>
        deleteDomain({
          params: { scope: "@acme", domain: "acme.dev" },
          req: post(undefined, token),
        }),
      overrides,
    );
    expect(del.status).toBe(200);
    expect(
      await statusOf(
        run(
          graph,
          () =>
            deleteDomain({
              params: { scope: "@acme", domain: "acme.dev" },
              req: post(undefined, token),
            }),
          overrides,
        ),
      ),
    ).toBe(404);
  });
});
