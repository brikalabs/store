import { beforeEach, describe, expect, test } from "bun:test";
import type { MemberRef, OrgMember, OrgMembers, OrgRole } from "./membership";
import {
  type ClaimVerifier,
  type DnsResolver,
  type DomainChallenge,
  domainChallengeHost,
  type OrgDomainRecord,
  type OrgDomains,
  type OrgRecord,
  type OrgScopedDomain,
  type OrgScopes,
  OrgService,
  type OrgStore,
} from "./org";
import type { OrgProfileInput } from "./profile";
import type { PublishIdentity } from "./publish";
import type { TrustedPublisher, TrustedPublishers } from "./trusted-publishers";

/**
 * OrgService is pure domain logic over the OrgStore + OrgMembers + OrgScopes + OrgDomains
 * ports, so it is tested with in-memory fakes - no database, no Cloudflare. The fakes
 * mirror the real adapters' contracts, including the atomic last-admin guard on
 * demote/remove and the race-safe `created` signal from the store's claim.
 */

class FakeOrgStore implements OrgStore {
  readonly rows = new Map<string, OrgRecord>();
  async get(slug: string): Promise<OrgRecord | null> {
    return this.rows.get(slug) ?? null;
  }
  async listAll(): Promise<OrgRecord[]> {
    return [...this.rows.values()];
  }
  async claim(slug: string): Promise<{ record: OrgRecord; created: boolean }> {
    const existing = this.rows.get(slug);
    if (existing) return { record: existing, created: false };
    const record: OrgRecord = {
      slug,
      displayName: null,
      description: null,
      links: [],
      iconKey: null,
      takedown: null,
    };
    this.rows.set(slug, record);
    return { record, created: true };
  }
  async setDisplayName(slug: string, displayName: string | null): Promise<void> {
    const row = this.rows.get(slug);
    if (row) this.rows.set(slug, { ...row, displayName });
  }
  async setProfile(slug: string, profile: OrgProfileInput): Promise<void> {
    const row = this.rows.get(slug);
    if (row)
      this.rows.set(slug, { ...row, description: profile.description, links: [...profile.links] });
  }
  async setIcon(slug: string, iconKey: string | null): Promise<void> {
    const row = this.rows.get(slug);
    if (row) this.rows.set(slug, { ...row, iconKey });
  }
  async setTakedown(slug: string, reason: string | null): Promise<void> {
    const row = this.rows.get(slug);
    if (row) this.rows.set(slug, { ...row, takedown: reason });
  }
}

class FakeOrgDomains implements OrgDomains {
  readonly rows = new Map<string, Map<string, OrgDomainRecord>>();
  #org(slug: string): Map<string, OrgDomainRecord> {
    const existing = this.rows.get(slug);
    if (existing) return existing;
    const fresh = new Map<string, OrgDomainRecord>();
    this.rows.set(slug, fresh);
    return fresh;
  }
  async list(slug: string): Promise<OrgDomainRecord[]> {
    return [...this.#org(slug).values()];
  }
  async get(slug: string, domain: string): Promise<OrgDomainRecord | null> {
    return this.#org(slug).get(domain) ?? null;
  }
  async add(slug: string, domain: string): Promise<OrgDomainRecord> {
    const org = this.#org(slug);
    if (!org.has(domain)) org.set(domain, { domain, verified: false });
    return org.get(domain) as OrgDomainRecord;
  }
  async setVerified(slug: string, domain: string, verified: boolean): Promise<void> {
    const record = this.#org(slug).get(domain);
    if (record) this.#org(slug).set(domain, { ...record, verified });
  }
  async remove(slug: string, domain: string): Promise<boolean> {
    return this.#org(slug).delete(domain);
  }
  async listAllVerified(): Promise<OrgScopedDomain[]> {
    return [...this.rows.entries()].flatMap(([orgSlug, ds]) =>
      [...ds.values()].filter((d) => d.verified).map((d) => ({ orgSlug, domain: d.domain })),
    );
  }
}

class FakeOrgScopes implements OrgScopes {
  readonly byScope = new Map<string, string>();
  async scopesForOrg(slug: string): Promise<string[]> {
    return [...this.byScope.entries()].filter(([, org]) => org === slug).map(([scope]) => scope);
  }
  async orgForScope(scope: string): Promise<string | null> {
    return this.byScope.get(scope) ?? null;
  }
  async attach(scope: string, orgSlug: string): Promise<{ scope: string; orgSlug: string }> {
    const existing = this.byScope.get(scope);
    if (existing === undefined) this.byScope.set(scope, orgSlug);
    return { scope, orgSlug: this.byScope.get(scope) as string };
  }
}

class FakeOrgMembers implements OrgMembers {
  readonly byOrg = new Map<string, Map<string, OrgMember>>();
  #key(m: MemberRef): string {
    return `${m.provider} ${m.id}`;
  }
  #org(org: string): Map<string, OrgMember> {
    const existing = this.byOrg.get(org);
    if (existing) return existing;
    const fresh = new Map<string, OrgMember>();
    this.byOrg.set(org, fresh);
    return fresh;
  }
  #admins(org: string): number {
    return [...this.#org(org).values()].filter((m) => m.role === "admin").length;
  }
  async roleOf(org: string, member: MemberRef): Promise<OrgRole | null> {
    return this.#org(org).get(this.#key(member))?.role ?? null;
  }
  async list(org: string): Promise<OrgMember[]> {
    return [...this.#org(org).values()];
  }
  async upsert(org: string, member: MemberRef, role: OrgRole): Promise<void> {
    this.#org(org).set(this.#key(member), { ...member, role });
  }
  async demoteFromAdmin(org: string, member: MemberRef): Promise<boolean> {
    const current = this.#org(org).get(this.#key(member));
    if (current?.role !== "admin" || this.#admins(org) <= 1) return false;
    this.#org(org).set(this.#key(member), { ...member, role: "member" });
    return true;
  }
  async remove(org: string, member: MemberRef): Promise<boolean> {
    const current = this.#org(org).get(this.#key(member));
    if (current === undefined) return false;
    if (current.role === "admin" && this.#admins(org) <= 1) return false;
    this.#org(org).delete(this.#key(member));
    return true;
  }
  async countOrgsAdminedBy(member: MemberRef): Promise<number> {
    return [...this.byOrg.values()].filter((m) => m.get(this.#key(member))?.role === "admin")
      .length;
  }
}

const gh = (owner: string): PublishIdentity => ({ provider: "github", owner, repository: null });
const ref = (id: string): MemberRef => ({ provider: "github", id });

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

let orgs: FakeOrgStore;
let members: FakeOrgMembers;
let scopes: FakeOrgScopes;
let domains: FakeOrgDomains;
let trusted: FakeTrustedPublishers;
let service: OrgService;
beforeEach(() => {
  orgs = new FakeOrgStore();
  members = new FakeOrgMembers();
  scopes = new FakeOrgScopes();
  domains = new FakeOrgDomains();
  trusted = new FakeTrustedPublishers();
  service = new OrgService(orgs, members, scopes, domains, { trustedPublishers: trusted });
});

describe("claim", () => {
  test("ORG-002-AC1: creates the org and seeds the caller as admin", async () => {
    const result = await service.claim(gh("alice"), "team");
    expect(result).toMatchObject({ ok: true, created: true });
    expect(await members.roleOf("team", ref("alice"))).toBe("admin");
  });

  test("is idempotent for an admin, and conflicts for anyone else", async () => {
    await service.claim(gh("alice"), "team");
    expect(await service.claim(gh("alice"), "team")).toMatchObject({ ok: true, created: false });
    const other = await service.claim(gh("mallory"), "team");
    expect(other).toMatchObject({ ok: false, status: 409 });
  });
});

describe("per-account org cap (ORG-005, anti-squatting)", () => {
  test("ORG-005-AC1: a new claim is refused once the per-account cap is reached", async () => {
    const capped = new OrgService(orgs, members, scopes, domains, { maxOrgsPerAccount: 2 });
    expect(await capped.claim(gh("alice"), "a")).toMatchObject({ ok: true, created: true });
    expect(await capped.claim(gh("alice"), "b")).toMatchObject({ ok: true, created: true });
    const third = await capped.claim(gh("alice"), "c");
    expect(third).toMatchObject({ ok: false, status: 429 });
    // the over-cap org was not created
    expect(await orgs.get("c")).toBeNull();
  });

  test("the cap is per identity, not global", async () => {
    const capped = new OrgService(orgs, members, scopes, domains, { maxOrgsPerAccount: 1 });
    expect(await capped.claim(gh("alice"), "a")).toMatchObject({ ok: true });
    // bob is a different identity, so he still has headroom
    expect(await capped.claim(gh("bob"), "b")).toMatchObject({ ok: true, created: true });
  });

  test("ORG-005-AC2: the cap is raisable (a higher-limit service lets the claim through)", async () => {
    const capped = new OrgService(orgs, members, scopes, domains, { maxOrgsPerAccount: 1 });
    await capped.claim(gh("alice"), "a");
    expect(await capped.claim(gh("alice"), "b")).toMatchObject({ ok: false, status: 429 });
    const raised = new OrgService(orgs, members, scopes, domains, { maxOrgsPerAccount: 2 });
    expect(await raised.claim(gh("alice"), "b")).toMatchObject({ ok: true, created: true });
  });

  test("re-claiming an org you already administer is exempt from the cap", async () => {
    const capped = new OrgService(orgs, members, scopes, domains, { maxOrgsPerAccount: 1 });
    await capped.claim(gh("alice"), "a");
    expect(await capped.claim(gh("alice"), "a")).toMatchObject({ ok: true, created: false });
  });
});

describe("claim verifier (ORG-006 seam)", () => {
  test("allow-all by default lets a claim through", async () => {
    expect(await service.claim(gh("alice"), "anything")).toMatchObject({ ok: true });
  });

  test("a denying verifier refuses the claim and creates no org", async () => {
    const denying: ClaimVerifier = {
      verify: () => Promise.resolve({ ok: false, message: "not verifiably yours" }),
    };
    const gated = new OrgService(orgs, members, scopes, domains, { claimVerifier: denying });
    expect(await gated.claim(gh("alice"), "microsoft")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await orgs.get("microsoft")).toBeNull();
  });
});

describe("scopes (1:N ownership)", () => {
  test("ORG-008-AC2 + ORG-002-AC2: an admin attaches scopes; the org owns all of them", async () => {
    await service.claim(gh("alice"), "acme");
    expect(await service.attachScope(gh("alice"), "acme", "@acme")).toMatchObject({ ok: true });
    expect(await service.attachScope(gh("alice"), "acme", "@acme-labs")).toMatchObject({
      ok: true,
    });
    const listed = await service.listScopes(gh("alice"), "acme");
    expect(listed).toMatchObject({ ok: true });
    expect((listed as { scopes: string[] }).scopes.sort()).toEqual(["@acme", "@acme-labs"]);
  });

  test("ORG-002-AC3: a scope cannot be attached to a second org", async () => {
    await service.claim(gh("alice"), "acme");
    await service.attachScope(gh("alice"), "acme", "@acme");
    await service.claim(gh("bob"), "other");
    expect(await service.attachScope(gh("bob"), "other", "@acme")).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  test("ORG-008-AC3: a non-admin member cannot attach a scope", async () => {
    await service.claim(gh("alice"), "acme");
    await service.setMember(gh("alice"), "acme", ref("bob"), "member");
    expect(await service.attachScope(gh("bob"), "acme", "@acme")).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});

describe("membership gates", () => {
  test("listMembers: 404 unknown org, 403 non-member, ok for a member", async () => {
    expect(await service.listMembers(gh("alice"), "team")).toMatchObject({ status: 404 });
    await service.claim(gh("alice"), "team");
    expect(await service.listMembers(gh("bob"), "team")).toMatchObject({ status: 403 });
    expect(await service.listMembers(gh("alice"), "team")).toMatchObject({ ok: true });
  });

  test("setMember/setDisplayName require admin", async () => {
    await service.claim(gh("alice"), "team");
    await service.setMember(gh("alice"), "team", ref("bob"), "member");
    // bob is a plain member -> cannot manage
    expect(await service.setMember(gh("bob"), "team", ref("carol"), "member")).toMatchObject({
      status: 403,
    });
    expect(await service.setDisplayName(gh("bob"), "team", "Team")).toMatchObject({
      status: 403,
    });
  });
});

describe("last-admin invariant", () => {
  test("the sole admin cannot be demoted or removed", async () => {
    await service.claim(gh("alice"), "team");
    expect(await service.setMember(gh("alice"), "team", ref("alice"), "member")).toMatchObject({
      status: 409,
    });
    expect(await service.removeMember(gh("alice"), "team", ref("alice"))).toMatchObject({
      status: 409,
    });
  });

  test("with a second admin, one can be removed", async () => {
    await service.claim(gh("alice"), "team");
    await service.setMember(gh("alice"), "team", ref("bob"), "admin");
    expect(await service.removeMember(gh("alice"), "team", ref("alice"))).toMatchObject({
      ok: true,
    });
    expect((await members.list("team")).map((m) => m.id)).toEqual(["bob"]);
  });

  test("removing a non-member is not_found", async () => {
    await service.claim(gh("alice"), "team");
    expect(await service.removeMember(gh("alice"), "team", ref("ghost"))).toMatchObject({
      status: 404,
    });
  });
});

describe("setDisplayName", () => {
  test("an admin sets it; null clears it", async () => {
    await service.claim(gh("alice"), "team");
    expect(await service.setDisplayName(gh("alice"), "team", "Team Co")).toMatchObject({
      ok: true,
    });
    expect((await orgs.get("team"))?.displayName).toBe("Team Co");
    await service.setDisplayName(gh("alice"), "team", null);
    expect((await orgs.get("team"))?.displayName).toBeNull();
  });
});

describe("profile (ORG-009)", () => {
  test("an admin sets description + links; getPublic exposes them", async () => {
    await service.claim(gh("alice"), "acme");
    const links = [{ label: "X", url: "https://x.com/acme" }];
    expect(
      await service.setProfile(gh("alice"), "acme", { description: "We build things", links }),
    ).toMatchObject({ ok: true });
    const pub = await service.getPublic("acme");
    expect(pub).toMatchObject({ description: "We build things", links });
  });

  test("a non-admin cannot set the profile or icon", async () => {
    await service.claim(gh("alice"), "acme");
    await service.setMember(gh("alice"), "acme", ref("bob"), "member");
    expect(
      await service.setProfile(gh("bob"), "acme", { description: "x", links: [] }),
    ).toMatchObject({ status: 403 });
    expect(await service.setIcon(gh("bob"), "acme", "org-icons/acme.png")).toMatchObject({
      status: 403,
    });
  });

  test("an admin sets + clears the icon key", async () => {
    await service.claim(gh("alice"), "acme");
    await service.setIcon(gh("alice"), "acme", "org-icons/acme.png");
    expect((await orgs.get("acme"))?.iconKey).toBe("org-icons/acme.png");
    await service.setIcon(gh("alice"), "acme", null);
    expect((await orgs.get("acme"))?.iconKey).toBeNull();
  });
});

describe("operator takedown (ORG-007)", () => {
  test("ORG-007-AC1: a taken-down org is withdrawn from public listings, then restorable", async () => {
    await service.claim(gh("alice"), "acme");
    expect(await service.getPublic("acme")).not.toBeNull();

    expect(await service.takedown("acme", "name-squatting")).toMatchObject({ ok: true });
    expect((await orgs.get("acme"))?.takedown).toBe("name-squatting");
    // Withdrawn from public listings, and the reason is never leaked publicly.
    expect(await service.getPublic("acme")).toBeNull();

    expect(await service.restore("acme")).toMatchObject({ ok: true });
    expect((await orgs.get("acme"))?.takedown).toBeNull();
    expect(await service.getPublic("acme")).not.toBeNull();
  });

  test("takedown of an unknown org is not_found (membership is not consulted)", async () => {
    expect(await service.takedown("ghost", "spam")).toMatchObject({ status: 404 });
    expect(await service.restore("ghost")).toMatchObject({ status: 404 });
  });

  test("listForOperator returns every org with its takedown state (no membership filter)", async () => {
    await service.claim(gh("alice"), "acme");
    await service.claim(gh("bob"), "beta");
    await service.takedown("beta", "squatting");
    const all = await service.listForOperator();
    expect(all.map((o) => o.slug).sort()).toEqual(["acme", "beta"]);
    expect(all.find((o) => o.slug === "beta")?.takedown).toBe("squatting");
  });
});

describe("trusted publishers (PUB-016)", () => {
  async function seedOrgWithScope() {
    await service.claim(gh("alice"), "acme");
    await service.attachScope(gh("alice"), "acme", "@acme");
  }

  const gh_binding = { provider: "github", repository: "acme/plugin-x", workflow: "publish.yml" };

  test("PUB-016-AC3: an admin adds, lists, and removes a binding for an owned scope", async () => {
    await seedOrgWithScope();
    expect(
      await service.addTrustedPublisher(gh("alice"), "acme", "@acme", gh_binding),
    ).toMatchObject({ ok: true });
    const listed = await service.listTrustedPublishers(gh("alice"), "acme", "@acme");
    expect(listed).toMatchObject({ ok: true, publishers: [{ scope: "@acme", ...gh_binding }] });
    expect(
      await service.removeTrustedPublisher(gh("alice"), "acme", "@acme", gh_binding),
    ).toMatchObject({ ok: true });
    expect(trusted.rows).toHaveLength(0);
  });

  test("a gitlab binding for the same repo coexists with the github one", async () => {
    await seedOrgWithScope();
    await service.addTrustedPublisher(gh("alice"), "acme", "@acme", gh_binding);
    await service.addTrustedPublisher(gh("alice"), "acme", "@acme", {
      provider: "gitlab",
      repository: "acme/plugin-x",
      workflow: ".gitlab-ci.yml",
    });
    expect((await service.listTrustedPublishers(gh("alice"), "acme", "@acme")).ok).toBe(true);
    expect(trusted.rows).toHaveLength(2);
  });

  test("a non-admin member cannot manage bindings", async () => {
    await seedOrgWithScope();
    await service.setMember(gh("alice"), "acme", ref("bob"), "member");
    expect(await service.addTrustedPublisher(gh("bob"), "acme", "@acme", gh_binding)).toMatchObject(
      { status: 403 },
    );
  });

  test("refuses a scope the org does not own", async () => {
    await seedOrgWithScope();
    expect(
      await service.addTrustedPublisher(gh("alice"), "acme", "@other", gh_binding),
    ).toMatchObject({ status: 404 });
  });

  test("removing an unknown binding is not_found", async () => {
    await seedOrgWithScope();
    expect(
      await service.removeTrustedPublisher(gh("alice"), "acme", "@acme", {
        ...gh_binding,
        workflow: "none.yml",
      }),
    ).toMatchObject({ status: 404 });
  });
});

describe("domains (ORG-010, badge-only, stateless HMAC challenge)", () => {
  // A deterministic stand-in for the HMAC challenge: token = `tok:<org>:<domain>`.
  const challenge: DomainChallenge = {
    token: (org, domain) => Promise.resolve(`tok:${org}:${domain}`),
  };
  // A resolver whose TXT records can be programmed per host.
  function dnsReturning(byHost: Record<string, string[]>): DnsResolver {
    return { txt: (host) => Promise.resolve(byHost[host] ?? []) };
  }

  test("ORG-010-AC1: the derived TXT verifies the domain at the _brika-challenge host", async () => {
    const host = domainChallengeHost("brika.dev");
    const dns = dnsReturning({ [host]: ["tok:acme:brika.dev"] });
    const svc = new OrgService(orgs, members, scopes, domains, {
      dnsResolver: dns,
      domainChallenge: challenge,
    });
    await svc.claim(gh("alice"), "acme");
    await svc.addDomain(gh("alice"), "acme", "brika.dev");
    // The expected token is derived (nothing stored), and exposed for display.
    expect(await svc.domainChallenge("acme", "brika.dev")).toBe("tok:acme:brika.dev");
    expect(await svc.verifyDomain(gh("alice"), "acme", "brika.dev")).toMatchObject({
      ok: true,
      verified: true,
    });
    expect((await svc.getPublic("acme"))?.verifiedDomains).toEqual(["brika.dev"]);
  });

  test("verify stays false when the TXT is absent or a DNS error is thrown", async () => {
    const throwing: DnsResolver = {
      txt: () => Promise.reject(new Error("network down")),
    };
    const svc = new OrgService(orgs, members, scopes, domains, {
      dnsResolver: throwing,
      domainChallenge: challenge,
    });
    await svc.claim(gh("alice"), "acme");
    await svc.addDomain(gh("alice"), "acme", "brika.dev");
    // A transport failure is treated as "not found", not an error.
    expect(await svc.verifyDomain(gh("alice"), "acme", "brika.dev")).toMatchObject({
      ok: true,
      verified: false,
    });
    expect((await svc.getPublic("acme"))?.verifiedDomains).toEqual([]);
  });

  test("ORG-010-AC2: a non-admin cannot add or verify; verifying an unclaimed domain is 404", async () => {
    await service.claim(gh("alice"), "acme");
    await service.setMember(gh("alice"), "acme", ref("bob"), "member");
    expect(await service.addDomain(gh("bob"), "acme", "brika.dev")).toMatchObject({
      status: 403,
    });
    expect(await service.verifyDomain(gh("alice"), "acme", "nope.dev")).toMatchObject({
      status: 404,
    });
  });

  test("an admin removes a claimed domain", async () => {
    await service.claim(gh("alice"), "acme");
    await service.addDomain(gh("alice"), "acme", "brika.dev");
    expect(await service.removeDomain(gh("alice"), "acme", "brika.dev")).toMatchObject({
      ok: true,
    });
    expect(await service.removeDomain(gh("alice"), "acme", "brika.dev")).toMatchObject({
      status: 404,
    });
  });

  test("ORG-010-AC3: reverify revokes a domain whose TXT is gone, but skips a DNS error", async () => {
    const host = domainChallengeHost("brika.dev");
    // First verify it (TXT present), then re-verify with the TXT gone -> revoked.
    const present = dnsReturning({ [host]: ["tok:acme:brika.dev"] });
    let svc = new OrgService(orgs, members, scopes, domains, {
      dnsResolver: present,
      domainChallenge: challenge,
    });
    await svc.claim(gh("alice"), "acme");
    await svc.addDomain(gh("alice"), "acme", "brika.dev");
    await svc.verifyDomain(gh("alice"), "acme", "brika.dev");

    // A transport error during the sweep must NOT revoke (skip).
    const throwing = new OrgService(orgs, members, scopes, domains, {
      dnsResolver: { txt: () => Promise.reject(new Error("dns down")) },
      domainChallenge: challenge,
    });
    expect(await throwing.reverifyDomains()).toEqual([]);
    expect((await svc.getPublic("acme"))?.verifiedDomains).toEqual(["brika.dev"]);

    // The TXT is now genuinely gone -> the sweep revokes the badge.
    svc = new OrgService(orgs, members, scopes, domains, {
      dnsResolver: dnsReturning({}),
      domainChallenge: challenge,
    });
    expect(await svc.reverifyDomains()).toEqual([{ orgSlug: "acme", domain: "brika.dev" }]);
    expect((await svc.getPublic("acme"))?.verifiedDomains).toEqual([]);
  });
});
