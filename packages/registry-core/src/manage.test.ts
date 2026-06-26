import { describe, expect, test } from "bun:test";
import { provide, testBed } from "@brika/di";
import { ManagementService, VersionManager } from "./manage";
import { OwnershipPolicy, type PublishIdentity } from "./publish";

const OWNER: PublishIdentity = { userId: "brikalabs", provider: null, repository: null };
const STRANGER: PublishIdentity = { userId: "someone-else", provider: null, repository: null };

function allowOwner(): OwnershipPolicy {
  return {
    canPublish: (identity) =>
      Promise.resolve(
        identity.userId === "brikalabs"
          ? { ok: true }
          : { ok: false, message: "scope @brika is owned by brikalabs" },
      ),
  };
}

class FakeVersions implements VersionManager {
  readonly deprecated = new Map<string, string | null>();
  readonly yanked = new Map<string, boolean>();
  readonly takedown = new Map<string, string | null>();
  readonly packageTakedown = new Map<string, string | null>();
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
  setPackageTakedown(name: string, reason: string | null): Promise<void> {
    this.packageTakedown.set(name, reason);
    return Promise.resolve();
  }
  readonly deleted = new Set<string>();
  deletePackage(name: string): Promise<void> {
    this.deleted.add(name);
    return Promise.resolve();
  }
  readonly created = new Map<string, string | null>();
  packageExists(name: string): Promise<boolean> {
    const hasVersion = [...this.existing].some((k) => k.startsWith(`${name}@`));
    return Promise.resolve(hasVersion || this.created.has(name));
  }
  createPackage(name: string, scope: string | null): Promise<void> {
    this.created.set(name, scope);
    return Promise.resolve();
  }
  readonly verifiedFlags = new Map<string, boolean>();
  setVerified(name: string, value: boolean): Promise<void> {
    this.verifiedFlags.set(name, value);
    return Promise.resolve();
  }
}

const NAME = "@brika/plugin-i18n";
const VERSION = "0.1.0";

function service(existing: string[] = [`${NAME}@${VERSION}`]) {
  const meta = new FakeVersions(new Set(existing));
  const svc = testBed(provide(VersionManager, meta), provide(OwnershipPolicy, allowOwner())).inject(
    ManagementService,
  );
  return { meta, svc };
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
      status: 403,
      message: "scope @brika is owned by brikalabs",
    });
    expect(meta.deprecated.size).toBe(0);
  });

  test("an unknown version is not_found", async () => {
    const { svc } = service([]);
    const result = await svc.deprecate(OWNER, NAME, "9.9.9", "x");
    expect(result).toEqual({
      ok: false,
      status: 404,
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
      status: 404,
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

describe("deletePackage", () => {
  test("owner can delete the whole package", async () => {
    const { meta, svc } = service();
    expect(await svc.deletePackage(OWNER, NAME)).toEqual({ ok: true });
    expect(meta.deleted.has(NAME)).toBe(true);
  });

  test("a non-owner is forbidden and nothing is deleted", async () => {
    const { meta, svc } = service();
    expect(await svc.deletePackage(STRANGER, NAME)).toEqual({
      ok: false,
      status: 403,
      message: "scope @brika is owned by brikalabs",
    });
    expect(meta.deleted.size).toBe(0);
  });
});

describe("setVerified", () => {
  test("an operator toggles the package's approved badge; 404 for an unknown package", async () => {
    const { meta, svc } = service();
    expect(await svc.setVerified(NAME, true)).toEqual({ ok: true });
    expect(meta.verifiedFlags.get(NAME)).toBe(true);
    expect(await svc.setVerified("@brika/ghost", true)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("reservePackage", () => {
  test("owner reserves a fresh name, creating the package row with its scope", async () => {
    const { meta, svc } = service([]);
    expect(await svc.reservePackage(OWNER, "@brika/new-plugin")).toEqual({ ok: true });
    expect(meta.created.get("@brika/new-plugin")).toBe("@brika");
  });

  test("an invalid name is rejected before any ownership check", async () => {
    const { meta, svc } = service([]);
    const result = await svc.reservePackage(OWNER, "Not_A_Valid/Name");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(meta.created.size).toBe(0);
  });

  test("a non-owner is forbidden and nothing is created", async () => {
    const { meta, svc } = service([]);
    expect((await svc.reservePackage(STRANGER, "@brika/new-plugin")).ok).toBe(false);
    expect(meta.created.size).toBe(0);
  });

  test("an already-taken name is a conflict", async () => {
    const { meta, svc } = service();
    const result = await svc.reservePackage(OWNER, NAME);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
    expect(meta.created.size).toBe(0);
  });
});

describe("takedownPackage / restorePackage (operator, whole package incl. future versions)", () => {
  test("takedown sets the package flag; restore clears it", async () => {
    const { meta, svc } = service();
    expect(await svc.takedownPackage(NAME, "policy violation")).toEqual({ ok: true });
    expect(meta.packageTakedown.get(NAME)).toBe("policy violation");
    // The per-version takedowns are untouched: this is a separate package-wide flag.
    expect(meta.takedown.size).toBe(0);
    expect(await svc.restorePackage(NAME)).toEqual({ ok: true });
    expect(meta.packageTakedown.get(NAME)).toBeNull();
  });

  test("truncates an over-long reason", async () => {
    const { meta, svc } = service();
    await svc.takedownPackage(NAME, "x".repeat(5000));
    expect(meta.packageTakedown.get(NAME)?.length).toBe(1024);
  });

  test("404s when the package does not exist, for both takedown and restore", async () => {
    const { meta, svc } = service([]);
    expect((await svc.takedownPackage("@brika/missing", "x")).ok).toBe(false);
    expect((await svc.restorePackage("@brika/missing")).ok).toBe(false);
    expect(meta.packageTakedown.size).toBe(0);
  });
});
