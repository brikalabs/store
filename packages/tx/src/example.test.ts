import { describe, expect, test } from "bun:test";
import { Publisher } from "./example";
import { FakeDb } from "./testing/fake-db";
import { InMemoryFiles } from "./testing/in-memory-files";

describe("Publisher", () => {
  test("publish commits the file, the metadata batch, and runs the afterCommit hook", async () => {
    const files = new InMemoryFiles();
    const db = new FakeDb();
    const publisher = new Publisher(files, db);
    await publisher.publish("react", "bytes");
    expect(files.has("react.tgz")).toBe(true);
    expect(db.has("version:react")).toBe(true);
    expect(publisher.published()).toEqual(["react"]); // afterCommit fired
  });

  test("a failure rolls back the file, commits no metadata, and skips afterCommit", async () => {
    const files = new InMemoryFiles();
    const db = new FakeDb();
    const publisher = new Publisher(files, db);
    await expect(publisher.publishThenFail("react", "bytes")).rejects.toThrow();
    expect(files.has("react.tgz")).toBe(false);
    expect(db.committed).toEqual([]);
    expect(publisher.published()).toEqual([]); // afterCommit did not fire
  });

  test("requiresNew: the audit survives the outer rollback", async () => {
    const files = new InMemoryFiles();
    const db = new FakeDb();
    await expect(new Publisher(files, db).publishWithAudit("react", "bytes")).rejects.toThrow();
    expect(files.has("react.tgz")).toBe(false); // outer rolled back
    expect(files.has("react.audit")).toBe(true); // independent inner tx committed
  });
});
