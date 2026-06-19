import { beforeEach, describe, expect, test } from "bun:test";
import { HttpError } from "@brika/router";
import { type Db, regDownloads } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { buildServices, type Services } from "../services";
import { makeDb, seedExamplePackage } from "../test-harness";
import { packagesController } from "./packages";

/**
 * Integration tests for the npm read protocol (packument + tarball). The routes
 * are driven directly via their `run` entrypoint with the matched npm `PKG`
 * params, against the real in-memory DB and an R2 bucket pre-seeded with the
 * tarball bytes.
 */

// route order: tarball (more specific) first, then packument.
const tarballRoute = packagesController.routes[0];
const packumentRoute = packagesController.routes[1];

/** An R2 bucket pre-seeded with one tarball at `key`. */
function r2With(key: string, bytes: Uint8Array): R2Bucket {
  const store = new Map<string, Uint8Array>([[key, bytes]]);
  const bucket = {
    get: async (k: string) => {
      const value = store.get(k);
      return value === undefined ? null : { body: new Response(value).body };
    },
    put: async (k: string, value: Uint8Array) => {
      store.set(k, value);
      return {};
    },
    delete: async (k: string) => {
      store.delete(k);
    },
  };
  return bucket as unknown as R2Bucket;
}

function noopWaitUntil(): void {}

let db: Db;
beforeEach(async () => {
  db = makeDb();
  await seedExamplePackage(db, "octocat");
});

function services(bucket: R2Bucket): Services {
  return buildServices(db, bucket, "http://localhost:8787");
}

async function expectStatus(run: () => Promise<unknown>, status: number): Promise<void> {
  try {
    await run();
    throw new Error(`expected a thrown ${status}`);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
  }
}

describe("packument route", () => {
  test("returns the full document as application/json by default", async () => {
    const res = (await packumentRoute?.run({
      params: { scope: "@brika", pkg: "x" },
      query: undefined,
      body: undefined,
      req: new Request("http://localhost/@brika%2fx"),
      ctx: services(r2With("k", new Uint8Array())),
      waitUntil: noopWaitUntil,
    })) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("vary")).toBe("accept");
    const doc = await res.json();
    expect(doc.name).toBe("@brika/x");
  });

  test("returns the abbreviated document when the install Accept header is sent", async () => {
    const res = (await packumentRoute?.run({
      params: { scope: "@brika", pkg: "x" },
      query: undefined,
      body: undefined,
      req: new Request("http://localhost/@brika%2fx", {
        headers: { accept: "application/vnd.npm.install-v1+json" },
      }),
      ctx: services(r2With("k", new Uint8Array())),
      waitUntil: noopWaitUntil,
    })) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.npm.install-v1+json");
  });

  test("404 for an unknown package", async () => {
    await expectStatus(
      () =>
        packumentRoute?.run({
          params: { scope: "@brika", pkg: "missing" },
          query: undefined,
          body: undefined,
          req: new Request("http://localhost/@brika%2fmissing"),
          ctx: services(r2With("k", new Uint8Array())),
          waitUntil: noopWaitUntil,
        }) ?? Promise.resolve(),
      404,
    );
  });
});

describe("tarball route", () => {
  const key = "@brika/x/-/x-1.0.0.tgz";

  test("streams the tarball and records the download via waitUntil", async () => {
    const tasks: Promise<unknown>[] = [];
    const res = (await tarballRoute?.run({
      params: { scope: "@brika", pkg: "x", file: "x-1.0.0.tgz" },
      query: undefined,
      body: undefined,
      req: new Request(`http://localhost/${key}`),
      ctx: services(r2With(key, new Uint8Array([1, 2, 3]))),
      waitUntil: (p) => tasks.push(p),
    })) as Response;

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    // The deferred install counter ran off the response path.
    await Promise.all(tasks);
    const rows = await db.select().from(regDownloads).where(eq(regDownloads.name, "@brika/x"));
    expect(rows[0]?.count).toBe(1);
  });

  test("404 when the filename does not parse to a version", async () => {
    await expectStatus(
      () =>
        tarballRoute?.run({
          params: { scope: "@brika", pkg: "x", file: "not-a-tarball.txt" },
          query: undefined,
          body: undefined,
          req: new Request("http://localhost/@brika%2fx/-/not-a-tarball.txt"),
          ctx: services(r2With(key, new Uint8Array([1]))),
          waitUntil: noopWaitUntil,
        }) ?? Promise.resolve(),
      404,
    );
  });

  test("404 when the tarball bytes are absent from R2", async () => {
    await expectStatus(
      () =>
        tarballRoute?.run({
          params: { scope: "@brika", pkg: "x", file: "x-9.9.9.tgz" },
          query: undefined,
          body: undefined,
          req: new Request("http://localhost/@brika%2fx/-/x-9.9.9.tgz"),
          ctx: services(r2With(key, new Uint8Array([1]))),
          waitUntil: noopWaitUntil,
        }) ?? Promise.resolve(),
      404,
    );
  });
});
