import { describe, expect, test } from "bun:test";
import { ManagementService, type VersionManager } from "./manage";
import type { OwnershipPolicy, PublishIdentity } from "./publish";

const OWNER: PublishIdentity = { owner: "brikalabs", repository: "brikalabs/store" };
const STRANGER: PublishIdentity = { owner: "someone-else", repository: null };

function allowOwner(): OwnershipPolicy {
  return {
    canPublish: (identity) =>
      Promise.resolve(
        identity.owner === "brikalabs"
          ? { ok: true }
          : { ok: false, message: "scope @brika is owned by brikalabs" },
      ),
  };
}

class FakeVersions implements VersionManager {
  readonly deprecated = new Map<string, string | null>();
  readonly yanked = new Map<string, boolean>();
  readonly takedown = new Map<string, string | null>();
  constructor(private readonly existing: Set<string>) {}
  versionExists(name: string, version: string): Promise<boolean> {
    return Promise.resolve(this.existing.has(`${name}@${version}`));
  }
  setDeprecated(name: string, version: string, message: string | null): Promise<void> {
    this.deprecated.set(`${name}@${version}`, message);
    return Promise.resolve();
  }
  setYanked(name: string, version: string, yanked: boolean): Promise<void> {
    this.yanked.set(`${name}@${version}`, yanked);
    return Promise.resolve();
  }
  setTakedown(name: string, version: string, reason: string | null): Promise<void> {
    this.takedown.set(`${name}@${version}`, reason);
    return Promise.resolve();
  }
}

const NAME = "@brika/plugin-i18n";
const VERSION = "0.1.0";

function service(existing: string[] = [`${NAME}@${VERSION}`]) {
  const meta = new FakeVersions(new Set(existing));
  return { meta, svc: new ManagementService(meta, allowOwner()) };
}

describe("deprecate", () => {
  test("owner can set and clear a deprecation message", async () => {
    const { meta, svc } = service();
    expect(await svc.deprecate(OWNER, NAME, VERSION, "use 0.2")).toEqual({ ok: true });
    expect(meta.deprecated.get(`${NAME}@${VERSION}`)).toBe("use 0.2");
    expect(await svc.deprecate(OWNER, NAME, VERSION, null)).toEqual({ ok: true });
    expect(meta.deprecated.get(`${NAME}@${VERSION}`)).toBeNull();
  });

  test("truncates an over-long message", async () => {
    const { meta, svc } = service();
    await svc.deprecate(OWNER, NAME, VERSION, "x".repeat(5000));
    expect(meta.deprecated.get(`${NAME}@${VERSION}`)?.length).toBe(1024);
  });

  test("a non-owner is forbidden and nothing is written", async () => {
    const { meta, svc } = service();
    const result = await svc.deprecate(STRANGER, NAME, VERSION, "nope");
    expect(result).toEqual({
      ok: false,
      code: "forbidden",
      message: "scope @brika is owned by brikalabs",
    });
    expect(meta.deprecated.size).toBe(0);
  });

  test("an unknown version is not_found", async () => {
    const { svc } = service([]);
    const result = await svc.deprecate(OWNER, NAME, "9.9.9", "x");
    expect(result).toEqual({
      ok: false,
      code: "not_found",
      message: `${NAME}@9.9.9 does not exist`,
    });
  });
});

describe("setYanked", () => {
  test("owner can yank and un-yank", async () => {
    const { meta, svc } = service();
    expect(await svc.setYanked(OWNER, NAME, VERSION, true)).toEqual({ ok: true });
    expect(meta.yanked.get(`${NAME}@${VERSION}`)).toBe(true);
    expect(await svc.setYanked(OWNER, NAME, VERSION, false)).toEqual({ ok: true });
    expect(meta.yanked.get(`${NAME}@${VERSION}`)).toBe(false);
  });

  test("a non-owner is forbidden", async () => {
    const { meta, svc } = service();
    const result = await svc.setYanked(STRANGER, NAME, VERSION, true);
    expect(result.ok).toBe(false);
    expect(meta.yanked.size).toBe(0);
  });

  test("an unknown version is not_found", async () => {
    const { svc } = service([]);
    const result = await svc.setYanked(OWNER, NAME, VERSION, true);
    expect(result).toEqual({
      ok: false,
      code: "not_found",
      message: `${NAME}@${VERSION} does not exist`,
    });
  });
});

describe("takedown / restore (operator, not ownership-gated)", () => {
  test("takedown sets the reason for any existing version, no ownership check", async () => {
    const { meta, svc } = service();
    expect(await svc.takedown(NAME, VERSION, "malware: exfiltrates env")).toEqual({ ok: true });
    expect(meta.takedown.get(`${NAME}@${VERSION}`)).toBe("malware: exfiltrates env");
  });

  test("restore clears the takedown", async () => {
    const { meta, svc } = service();
    await svc.takedown(NAME, VERSION, "malware");
    expect(await svc.restore(NAME, VERSION)).toEqual({ ok: true });
    expect(meta.takedown.get(`${NAME}@${VERSION}`)).toBeNull();
  });

  test("truncates an over-long reason", async () => {
    const { meta, svc } = service();
    await svc.takedown(NAME, VERSION, "x".repeat(5000));
    expect(meta.takedown.get(`${NAME}@${VERSION}`)?.length).toBe(1024);
  });

  test("an unknown version is not_found for both takedown and restore", async () => {
    const { meta, svc } = service([]);
    expect((await svc.takedown(NAME, "9.9.9", "x")).ok).toBe(false);
    expect((await svc.restore(NAME, "9.9.9")).ok).toBe(false);
    expect(meta.takedown.size).toBe(0);
  });
});
