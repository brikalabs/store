import { beforeEach, describe, expect, test } from "bun:test";
import type { ScopeMember, ScopeMembers, ScopeRole } from "./membership";
import type { ScopeProfileInput } from "./profile";
import type { PublishIdentity } from "./publish";
import {
  type ClaimVerifier,
  type DnsResolver,
  type DomainChallenge,
  domainChallengeHost,
  type ScopeDomainRecord,
  type ScopeDomains,
  type ScopeRecord,
  type ScopeScopedDomain,
  ScopeService,
  type ScopeStore,
} from "./scope";
import type { TrustedPublisher, TrustedPublishers } from "./trusted-publishers";

/**
 * ScopeService is pure domain logic over the ScopeStore + ScopeMembers + ScopeDomains ports,
 * so it is tested with in-memory fakes - no database, no Cloudflare. The fakes mirror the
 * real adapters' contracts, including the atomic last-admin guard on demote/remove and the
 * race-safe `created` signal from the store's claim.
 */

class FakeScopeStore implements ScopeStore {
  readonly rows = new Map<string, ScopeRecord>();
  async get(scope: string): Promise<ScopeRecord | null> {
    return this.rows.get(scope) ?? null;
  }
  async listAll(): Promise<ScopeRecord[]> {
    return [...this.rows.values()];
  }
  async claim(scope: string): Promise<{ record: ScopeRecord; created: boolean }> {
    const existing = this.rows.get(scope);
    if (existing) return { record: existing, created: false };
    const record: ScopeRecord = {
      scope,
      displayName: null,
      description: null,
      links: [],
      iconKey: null,
      takedown: null,
    };
    this.rows.set(scope, record);
    return { record, created: true };
  }
  async setDisplayName(scope: string, displayName: string | null): Promise<void> {
    const row = this.rows.get(scope);
    if (row) this.rows.set(scope, { ...row, displayName });
  }
  async setProfile(scope: string, profile: ScopeProfileInput): Promise<void> {
    const row = this.rows.get(scope);
    if (row)
      this.rows.set(scope, { ...row, description: profile.description, links: [...profile.links] });
  }
  async setIcon(scope: string, iconKey: string | null): Promise<void> {
    const row = this.rows.get(scope);
    if (row) this.rows.set(scope, { ...row, iconKey });
  }
  async setTakedown(scope: string, reason: string | null): Promise<void> {
    const row = this.rows.get(scope);
    if (row) this.rows.set(scope, { ...row, takedown: reason });
  }
}

class FakeScopeDomains implements ScopeDomains {
  readonly rows = new Map<string, Map<string, ScopeDomainRecord>>();
  #scope(scope: string): Map<string, ScopeDomainRecord> {
    const existing = this.rows.get(scope);
    if (existing) return existing;
    const fresh = new Map<string, ScopeDomainRecord>();
    this.rows.set(scope, fresh);
    return fresh;
  }
  async list(scope: string): Promise<ScopeDomainRecord[]> {
    return [...this.#scope(scope).values()];
  }
  async get(scope: string, domain: string): Promise<ScopeDomainRecord | null> {
    return this.#scope(scope).get(domain) ?? null;
  }
  async add(scope: string, domain: string): Promise<ScopeDomainRecord> {
    const s = this.#scope(scope);
    if (!s.has(domain)) s.set(domain, { domain, verified: false });
    return s.get(domain) as ScopeDomainRecord;
  }
  async setVerified(scope: string, domain: string, verified: boolean): Promise<void> {
    const record = this.#scope(scope).get(domain);
    if (record) this.#scope(scope).set(domain, { ...record, verified });
  }
  async remove(scope: string, domain: string): Promise<boolean> {
    return this.#scope(scope).delete(domain);
  }
  async listAllVerified(): Promise<ScopeScopedDomain[]> {
    return [...this.rows.entries()].flatMap(([scope, ds]) =>
      [...ds.values()].filter((d) => d.verified).map((d) => ({ scope, domain: d.domain })),
    );
  }
}

class FakeScopeMembers implements ScopeMembers {
  readonly byScope = new Map<string, Map<string, ScopeMember>>();
  #scope(scope: string): Map<string, ScopeMember> {
    const existing = this.byScope.get(scope);
    if (existing) return existing;
    const fresh = new Map<string, ScopeMember>();
    this.byScope.set(scope, fresh);
    return fresh;
  }
  #admins(scope: string): number {
    return [...this.#scope(scope).values()].filter((m) => m.role === "admin").length;
  }
  async roleOf(scope: string, userId: string): Promise<ScopeRole | null> {
    return this.#scope(scope).get(userId)?.role ?? null;
  }
  async list(scope: string): Promise<ScopeMember[]> {
    return [...this.#scope(scope).values()];
  }
  async upsert(scope: string, userId: string, role: ScopeRole): Promise<void> {
    this.#scope(scope).set(userId, { userId, role });
  }
  async demoteFromAdmin(scope: string, userId: string): Promise<boolean> {
    const current = this.#scope(scope).get(userId);
    if (current?.role !== "admin" || this.#admins(scope) <= 1) return false;
    this.#scope(scope).set(userId, { userId, role: "member" });
    return true;
  }
  async remove(scope: string, userId: string): Promise<boolean> {
    const current = this.#scope(scope).get(userId);
    if (current === undefined) return false;
    if (current.role === "admin" && this.#admins(scope) <= 1) return false;
    this.#scope(scope).delete(userId);
    return true;
  }
  async countScopesAdminedBy(userId: string): Promise<number> {
    return [...this.byScope.values()].filter((m) => m.get(userId)?.role === "admin").length;
  }
}

const gh = (userId: string): PublishIdentity => ({ userId, provider: null, repository: null });
const ref = (id: string): string => id;

class FakeTrustedPublishers implements TrustedPublishers {
  readonly rows: TrustedPublisher[] = [];
  #key(b: TrustedPublisher) {
    return `${b.scope} ${b.provider} ${b.repository} ${b.workflow}`;
  }
  async listForScope(scope: string): Promise<TrustedPublisher[]> {
    return this.rows.filter((b) => b.scope === scope);
  }
  async add(binding: TrustedPublisher): Promise<TrustedPublisher> {
    if (!this.rows.some((b) => this.#key(b) === this.#key(binding))) this.rows.push(binding);
    return binding;
  }
  async remove(
    scope: string,
    provider: string,
    repository: string,
    workflow: string,
  ): Promise<boolean> {
    const i = this.rows.findIndex(
      (b) => this.#key(b) === this.#key({ scope, provider, repository, workflow }),
    );
    if (i === -1) return false;
    this.rows.splice(i, 1);
    return true;
  }
}

let scopes: FakeScopeStore;
let members: FakeScopeMembers;
let domains: FakeScopeDomains;
let trusted: FakeTrustedPublishers;
let service: ScopeService;
beforeEach(() => {
  scopes = new FakeScopeStore();
  members = new FakeScopeMembers();
  domains = new FakeScopeDomains();
  trusted = new FakeTrustedPublishers();
  service = new ScopeService(scopes, members, domains, { trustedPublishers: trusted });
});

describe("claim", () => {
  test("ORG-002-AC1: creates the scope and seeds the caller as admin", async () => {
    const result = await service.claim(gh("alice"), "@team");
    expect(result).toMatchObject({ ok: true, created: true });
    expect(await members.roleOf("@team", ref("alice"))).toBe("admin");
  });

  test("is idempotent for an admin, and conflicts for anyone else", async () => {
    await service.claim(gh("alice"), "@team");
    expect(await service.claim(gh("alice"), "@team")).toMatchObject({ ok: true, created: false });
    const other = await service.claim(gh("mallory"), "@team");
    expect(other).toMatchObject({ ok: false, status: 409 });
  });
});

describe("per-account scope cap (ORG-005, anti-squatting)", () => {
  test("ORG-005-AC1: a new claim is refused once the per-account cap is reached", async () => {
    const capped = new ScopeService(scopes, members, domains, { maxScopesPerAccount: 2 });
    expect(await capped.claim(gh("alice"), "@a")).toMatchObject({ ok: true, created: true });
    expect(await capped.claim(gh("alice"), "@b")).toMatchObject({ ok: true, created: true });
    const third = await capped.claim(gh("alice"), "@c");
    expect(third).toMatchObject({ ok: false, status: 429 });
    // the over-cap scope was not created
    expect(await scopes.get("@c")).toBeNull();
  });

  test("the cap is per identity, not global", async () => {
    const capped = new ScopeService(scopes, members, domains, { maxScopesPerAccount: 1 });
    expect(await capped.claim(gh("alice"), "@a")).toMatchObject({ ok: true });
    // bob is a different identity, so he still has headroom
    expect(await capped.claim(gh("bob"), "@b")).toMatchObject({ ok: true, created: true });
  });

  test("ORG-005-AC2: the cap is raisable (a higher-limit service lets the claim through)", async () => {
    const capped = new ScopeService(scopes, members, domains, { maxScopesPerAccount: 1 });
    await capped.claim(gh("alice"), "@a");
    expect(await capped.claim(gh("alice"), "@b")).toMatchObject({ ok: false, status: 429 });
    const raised = new ScopeService(scopes, members, domains, { maxScopesPerAccount: 2 });
    expect(await raised.claim(gh("alice"), "@b")).toMatchObject({ ok: true, created: true });
  });

  test("re-claiming a scope you already administer is exempt from the cap", async () => {
    const capped = new ScopeService(scopes, members, domains, { maxScopesPerAccount: 1 });
    await capped.claim(gh("alice"), "@a");
    expect(await capped.claim(gh("alice"), "@a")).toMatchObject({ ok: true, created: false });
  });
});

describe("claim verifier (ORG-006 seam)", () => {
  test("allow-all by default lets a claim through", async () => {
    expect(await service.claim(gh("alice"), "@anything")).toMatchObject({ ok: true });
  });

  test("a denying verifier refuses the claim and creates no scope", async () => {
    const denying: ClaimVerifier = {
      verify: () => Promise.resolve({ ok: false, message: "not verifiably yours" }),
    };
    const gated = new ScopeService(scopes, members, domains, { claimVerifier: denying });
    expect(await gated.claim(gh("alice"), "@microsoft")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await scopes.get("@microsoft")).toBeNull();
  });
});

describe("membership gates", () => {
  test("listMembers: 404 unknown scope, 403 non-member, ok for a member", async () => {
    expect(await service.listMembers(gh("alice"), "@team")).toMatchObject({ status: 404 });
    await service.claim(gh("alice"), "@team");
    expect(await service.listMembers(gh("bob"), "@team")).toMatchObject({ status: 403 });
    expect(await service.listMembers(gh("alice"), "@team")).toMatchObject({ ok: true });
  });

  test("setMember/setDisplayName require admin", async () => {
    await service.claim(gh("alice"), "@team");
    await service.setMember(gh("alice"), "@team", ref("bob"), "member");
    // bob is a plain member -> cannot manage
    expect(await service.setMember(gh("bob"), "@team", ref("carol"), "member")).toMatchObject({
      status: 403,
    });
    expect(await service.setDisplayName(gh("bob"), "@team", "Team")).toMatchObject({
      status: 403,
    });
  });
});

describe("last-admin invariant", () => {
  test("the sole admin cannot be demoted or removed", async () => {
    await service.claim(gh("alice"), "@team");
    expect(await service.setMember(gh("alice"), "@team", ref("alice"), "member")).toMatchObject({
      status: 409,
    });
    expect(await service.removeMember(gh("alice"), "@team", ref("alice"))).toMatchObject({
      status: 409,
    });
  });

  test("with a second admin, one can be removed", async () => {
    await service.claim(gh("alice"), "@team");
    await service.setMember(gh("alice"), "@team", ref("bob"), "admin");
    expect(await service.removeMember(gh("alice"), "@team", ref("alice"))).toMatchObject({
      ok: true,
    });
    expect((await members.list("@team")).map((m) => m.userId)).toEqual(["bob"]);
  });

  test("removing a non-member is not_found", async () => {
    await service.claim(gh("alice"), "@team");
    expect(await service.removeMember(gh("alice"), "@team", ref("ghost"))).toMatchObject({
      status: 404,
    });
  });
});

describe("setDisplayName", () => {
  test("an admin sets it; null clears it", async () => {
    await service.claim(gh("alice"), "@team");
    expect(await service.setDisplayName(gh("alice"), "@team", "Team Co")).toMatchObject({
      ok: true,
    });
    expect((await scopes.get("@team"))?.displayName).toBe("Team Co");
    await service.setDisplayName(gh("alice"), "@team", null);
    expect((await scopes.get("@team"))?.displayName).toBeNull();
  });
});

describe("profile (ORG-009)", () => {
  test("an admin sets description + links; getPublic exposes them", async () => {
    await service.claim(gh("alice"), "@acme");
    const links = [{ label: "X", url: "https://x.com/acme" }];
    expect(
      await service.setProfile(gh("alice"), "@acme", { description: "We build things", links }),
    ).toMatchObject({ ok: true });
    const pub = await service.getPublic("@acme");
    expect(pub).toMatchObject({ description: "We build things", links });
  });

  test("a non-admin cannot set the profile or icon", async () => {
    await service.claim(gh("alice"), "@acme");
    await service.setMember(gh("alice"), "@acme", ref("bob"), "member");
    expect(
      await service.setProfile(gh("bob"), "@acme", { description: "x", links: [] }),
    ).toMatchObject({ status: 403 });
    expect(await service.setIcon(gh("bob"), "@acme", "scope-icons/acme.png")).toMatchObject({
      status: 403,
    });
  });

  test("an admin sets + clears the icon key; getPublic exposes only whether one exists", async () => {
    await service.claim(gh("alice"), "@acme");
    await service.setIcon(gh("alice"), "@acme", "scope-icons/acme.png");
    expect((await scopes.get("@acme"))?.iconKey).toBe("scope-icons/acme.png");
    expect((await service.getPublic("@acme"))?.hasIcon).toBe(true);
    await service.setIcon(gh("alice"), "@acme", null);
    expect((await scopes.get("@acme"))?.iconKey).toBeNull();
    expect((await service.getPublic("@acme"))?.hasIcon).toBe(false);
  });
});

describe("operator takedown (ORG-007)", () => {
  test("ORG-007-AC1: a taken-down scope is withdrawn from public listings, then restorable", async () => {
    await service.claim(gh("alice"), "@acme");
    expect(await service.getPublic("@acme")).not.toBeNull();

    expect(await service.takedown("@acme", "name-squatting")).toMatchObject({ ok: true });
    expect((await scopes.get("@acme"))?.takedown).toBe("name-squatting");
    // Withdrawn from public listings, and the reason is never leaked publicly.
    expect(await service.getPublic("@acme")).toBeNull();

    expect(await service.restore("@acme")).toMatchObject({ ok: true });
    expect((await scopes.get("@acme"))?.takedown).toBeNull();
    expect(await service.getPublic("@acme")).not.toBeNull();
  });

  test("takedown of an unknown scope is not_found (membership is not consulted)", async () => {
    expect(await service.takedown("@ghost", "spam")).toMatchObject({ status: 404 });
    expect(await service.restore("@ghost")).toMatchObject({ status: 404 });
  });

  test("listForOperator returns every scope with its takedown state (no membership filter)", async () => {
    await service.claim(gh("alice"), "@acme");
    await service.claim(gh("bob"), "@beta");
    await service.takedown("@beta", "squatting");
    const all = await service.listForOperator();
    expect(all.map((s) => s.scope).sort()).toEqual(["@acme", "@beta"]);
    expect(all.find((s) => s.scope === "@beta")?.takedown).toBe("squatting");
  });
});

describe("trusted publishers (PUB-016)", () => {
  const gh_binding = { provider: "github", repository: "acme/plugin-x", workflow: "publish.yml" };

  test("PUB-016-AC3: an admin adds, lists, and removes a binding for the scope", async () => {
    await service.claim(gh("alice"), "@acme");
    expect(await service.addTrustedPublisher(gh("alice"), "@acme", gh_binding)).toMatchObject({
      ok: true,
    });
    const listed = await service.listTrustedPublishers(gh("alice"), "@acme");
    expect(listed).toMatchObject({ ok: true, publishers: [{ scope: "@acme", ...gh_binding }] });
    expect(await service.removeTrustedPublisher(gh("alice"), "@acme", gh_binding)).toMatchObject({
      ok: true,
    });
    expect(trusted.rows).toHaveLength(0);
  });

  test("a gitlab binding for the same repo coexists with the github one", async () => {
    await service.claim(gh("alice"), "@acme");
    await service.addTrustedPublisher(gh("alice"), "@acme", gh_binding);
    await service.addTrustedPublisher(gh("alice"), "@acme", {
      provider: "gitlab",
      repository: "acme/plugin-x",
      workflow: ".gitlab-ci.yml",
    });
    expect((await service.listTrustedPublishers(gh("alice"), "@acme")).ok).toBe(true);
    expect(trusted.rows).toHaveLength(2);
  });

  test("a non-admin member cannot manage bindings", async () => {
    await service.claim(gh("alice"), "@acme");
    await service.setMember(gh("alice"), "@acme", ref("bob"), "member");
    expect(await service.addTrustedPublisher(gh("bob"), "@acme", gh_binding)).toMatchObject({
      status: 403,
    });
  });

  test("removing an unknown binding is not_found", async () => {
    await service.claim(gh("alice"), "@acme");
    expect(
      await service.removeTrustedPublisher(gh("alice"), "@acme", {
        ...gh_binding,
        workflow: "none.yml",
      }),
    ).toMatchObject({ status: 404 });
  });
});

describe("domains (ORG-010, badge-only, stateless HMAC challenge)", () => {
  // A deterministic stand-in for the HMAC challenge: token = `tok:<scope>:<domain>`.
  const challenge: DomainChallenge = {
    token: (scope, domain) => Promise.resolve(`tok:${scope}:${domain}`),
  };
  // A resolver whose TXT records can be programmed per host.
  function dnsReturning(byHost: Record<string, string[]>): DnsResolver {
    return { txt: (host) => Promise.resolve(byHost[host] ?? []) };
  }

  test("ORG-010-AC1: the derived TXT verifies the domain at the _brika-challenge host", async () => {
    const host = domainChallengeHost("brika.dev");
    const dns = dnsReturning({ [host]: ["tok:@acme:brika.dev"] });
    const svc = new ScopeService(scopes, members, domains, {
      dnsResolver: dns,
      domainChallenge: challenge,
    });
    await svc.claim(gh("alice"), "@acme");
    await svc.addDomain(gh("alice"), "@acme", "brika.dev");
    // The expected token is derived (nothing stored), and exposed for display.
    expect(await svc.domainChallenge("@acme", "brika.dev")).toBe("tok:@acme:brika.dev");
    expect(await svc.verifyDomain(gh("alice"), "@acme", "brika.dev")).toMatchObject({
      ok: true,
      verified: true,
    });
    expect((await svc.getPublic("@acme"))?.verifiedDomains).toEqual(["brika.dev"]);
  });

  test("verify stays false when the TXT is absent or a DNS error is thrown", async () => {
    const throwing: DnsResolver = {
      txt: () => Promise.reject(new Error("network down")),
    };
    const svc = new ScopeService(scopes, members, domains, {
      dnsResolver: throwing,
      domainChallenge: challenge,
    });
    await svc.claim(gh("alice"), "@acme");
    await svc.addDomain(gh("alice"), "@acme", "brika.dev");
    // A transport failure is treated as "not found", not an error.
    expect(await svc.verifyDomain(gh("alice"), "@acme", "brika.dev")).toMatchObject({
      ok: true,
      verified: false,
    });
    expect((await svc.getPublic("@acme"))?.verifiedDomains).toEqual([]);
  });

  test("ORG-010-AC2: a non-admin cannot add or verify; verifying an unclaimed domain is 404", async () => {
    await service.claim(gh("alice"), "@acme");
    await service.setMember(gh("alice"), "@acme", ref("bob"), "member");
    expect(await service.addDomain(gh("bob"), "@acme", "brika.dev")).toMatchObject({
      status: 403,
    });
    expect(await service.verifyDomain(gh("alice"), "@acme", "nope.dev")).toMatchObject({
      status: 404,
    });
  });

  test("an admin removes a claimed domain", async () => {
    await service.claim(gh("alice"), "@acme");
    await service.addDomain(gh("alice"), "@acme", "brika.dev");
    expect(await service.removeDomain(gh("alice"), "@acme", "brika.dev")).toMatchObject({
      ok: true,
    });
    expect(await service.removeDomain(gh("alice"), "@acme", "brika.dev")).toMatchObject({
      status: 404,
    });
  });

  test("ORG-010-AC3: reverify revokes a domain whose TXT is gone, but skips a DNS error", async () => {
    const host = domainChallengeHost("brika.dev");
    // First verify it (TXT present), then re-verify with the TXT gone -> revoked.
    const present = dnsReturning({ [host]: ["tok:@acme:brika.dev"] });
    let svc = new ScopeService(scopes, members, domains, {
      dnsResolver: present,
      domainChallenge: challenge,
    });
    await svc.claim(gh("alice"), "@acme");
    await svc.addDomain(gh("alice"), "@acme", "brika.dev");
    await svc.verifyDomain(gh("alice"), "@acme", "brika.dev");

    // A transport error during the sweep must NOT revoke (skip).
    const throwing = new ScopeService(scopes, members, domains, {
      dnsResolver: { txt: () => Promise.reject(new Error("dns down")) },
      domainChallenge: challenge,
    });
    expect(await throwing.reverifyDomains()).toEqual([]);
    expect((await svc.getPublic("@acme"))?.verifiedDomains).toEqual(["brika.dev"]);

    // The TXT is now genuinely gone -> the sweep revokes the badge.
    svc = new ScopeService(scopes, members, domains, {
      dnsResolver: dnsReturning({}),
      domainChallenge: challenge,
    });
    expect(await svc.reverifyDomains()).toEqual([{ scope: "@acme", domain: "brika.dev" }]);
    expect((await svc.getPublic("@acme"))?.verifiedDomains).toEqual([]);
  });
});
