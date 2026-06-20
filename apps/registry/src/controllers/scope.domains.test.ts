import { beforeEach, describe, expect, mock, test } from "bun:test";
import { type DnsResolver, type DomainChallenge, ScopeService } from "@brika/registry-core";
import { HttpError } from "@brika/router";
import type { Db } from "@brika/store-db";
import { D1ScopeDomains, D1ScopeMembers, D1ScopeStore, issueToken } from "@brika/store-db/adapters";
import { buildServices, type Services } from "../services";
import { fakeR2, makeDb } from "../test-harness";

/**
 * Controller tests for the scope profile/domain handlers (ORG-009/010): the thin HTTP layer
 * over `ctx.scopes`. `cloudflare:workers` is stubbed (the publish/manage controllers
 * transitively import it); handlers are imported after the stub.
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

function services(db: Db): Services {
  return buildServices(db, fakeR2(), "http://localhost:8787");
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
  await createScope({ params: { scope }, req: post(undefined, token), ctx: services(db) });
  return token;
}

describe("getScope (public)", () => {
  test("200 with the scope's public fields (no sub-scopes); 404 for an unknown scope", async () => {
    await seedScopeAdmin("alice", "@acme");
    const ctx = services(db);
    const res = await getScope({ params: { scope: "@acme" }, ctx });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, scope: "@acme", iconKey: null });
    // A scope no longer owns sub-scopes: the public payload exposes no `scopes` array.
    expect(body).not.toHaveProperty("scopes");
    expect(await statusOf(getScope({ params: { scope: "@nope" }, ctx }))).toBe(404);
  });
});

describe("setProfile (ORG-009)", () => {
  test("an admin sets description + links; a non-member is forbidden", async () => {
    const alice = await seedScopeAdmin("alice", "@acme");
    const body = {
      description: "We build things",
      links: [{ label: "X", url: "https://x.com/a" }],
    };
    const res = await setProfile({
      params: { scope: "@acme" },
      body,
      req: post(body, alice),
      ctx: services(db),
    });
    expect(res.status).toBe(200);

    const bob = await issueToken(db, "bob");
    expect(
      await statusOf(
        setProfile({
          params: { scope: "@acme" },
          body: { description: null, links: [] },
          req: post(undefined, bob),
          ctx: services(db),
        }),
      ),
    ).toBe(403);
  });
});

describe("domains (ORG-010)", () => {
  test("add returns the TXT host + value; list reflects it; a bad domain is 400; non-admin 403", async () => {
    const alice = await seedScopeAdmin("alice", "@acme");
    const add = await addDomain({
      params: { scope: "@acme", domain: "acme.dev" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    expect(add.status).toBe(201);
    const added = (await add.json()) as { host: string; txt: string };
    expect(added.host).toBe("_brika-challenge.acme.dev");
    expect(added.txt.length).toBeGreaterThan(0);

    const list = await listDomains({
      params: { scope: "@acme" },
      req: post(undefined, alice),
      ctx: services(db),
    });
    const listed = (await list.json()) as { domains: { domain: string; host: string }[] };
    expect(listed.domains).toMatchObject([
      { domain: "acme.dev", host: "_brika-challenge.acme.dev" },
    ]);

    // A non-canonical domain is rejected at the controller (parseDomain -> 400).
    expect(
      await statusOf(
        addDomain({
          params: { scope: "@acme", domain: "not a domain" },
          req: post(undefined, alice),
          ctx: services(db),
        }),
      ),
    ).toBe(400);

    const bob = await issueToken(db, "bob");
    expect(
      await statusOf(
        addDomain({
          params: { scope: "@acme", domain: "evil.dev" },
          req: post(undefined, bob),
          ctx: services(db),
        }),
      ),
    ).toBe(403);
  });

  test("verify flips to verified when the challenge TXT resolves; delete removes (then 404)", async () => {
    // A custom service with deterministic challenge + a resolver that returns it.
    const challenge: DomainChallenge = { token: () => Promise.resolve("TOK") };
    const dns: DnsResolver = { txt: () => Promise.resolve(["TOK"]) };
    const scopes = new ScopeService(
      new D1ScopeStore(db),
      new D1ScopeMembers(db),
      new D1ScopeDomains(db),
      { domainChallenge: challenge, dnsResolver: dns },
    );
    const ctx: Services = { ...services(db), scopes };
    const token = await issueToken(db, "alice");
    await createScope({ params: { scope: "@acme" }, req: post(undefined, token), ctx });
    await addDomain({
      params: { scope: "@acme", domain: "acme.dev" },
      req: post(undefined, token),
      ctx,
    });

    const verify = await verifyDomain({
      params: { scope: "@acme", domain: "acme.dev" },
      req: post(undefined, token),
      ctx,
    });
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({ verified: true });

    const del = await deleteDomain({
      params: { scope: "@acme", domain: "acme.dev" },
      req: post(undefined, token),
      ctx,
    });
    expect(del.status).toBe(200);
    expect(
      await statusOf(
        deleteDomain({
          params: { scope: "@acme", domain: "acme.dev" },
          req: post(undefined, token),
          ctx,
        }),
      ),
    ).toBe(404);
  });
});
