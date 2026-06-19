import { type Batchable, type TransactionalDb, transactionalDb } from "./adapters/orm";
import { type FileStore, transactionalStorage } from "./adapters/storage";
import { requiresNew } from "./core/propagation";
import { afterCommit, transactional } from "./core/transaction";

/**
 * A publish-like service, the way it reads with the wrappers + `@transactional`:
 * wrap the raw resources once in the constructor, then write ordinary code. Stage
 * reversible work (the file) first; the atomic DB batch is the commit point. No
 * `commit()`, no `compensate()`, no transaction object threaded through.
 */
export class Publisher {
  readonly #files: FileStore;
  readonly #db: Batchable<string> & TransactionalDb<string>;
  readonly #published: string[] = [];

  constructor(files: FileStore, db: Batchable<string>) {
    this.#files = transactionalStorage(files);
    this.#db = transactionalDb(db);
  }

  @transactional()
  async publish(name: string, bytes: string): Promise<void> {
    await this.#files.put(`${name}.tgz`, bytes); // staged; auto-rolls-back on failure
    await this.#db.deferBatch([`version:${name}`]); // atomic, runs at the commit point
    afterCommit(() => {
      this.#published.push(name); // side effect only if the tx commits
    });
  }

  /** Names recorded by the {@link afterCommit} hook (e.g. where you would notify or bust a cache). */
  published(): readonly string[] {
    return this.#published;
  }

  @transactional()
  async publishThenFail(name: string, bytes: string): Promise<void> {
    await this.#files.put(`${name}.tgz`, bytes);
    throw new Error("commit failed"); // the staged file is deleted; the batch never runs
  }

  /** Audit in its own transaction, so it survives an outer rollback. */
  @transactional({ propagation: requiresNew })
  async audit(name: string): Promise<void> {
    await this.#files.put(`${name}.audit`, "logged");
  }

  @transactional()
  async publishWithAudit(name: string, bytes: string): Promise<void> {
    await this.#files.put(`${name}.tgz`, bytes);
    await this.audit(name); // independent inner tx -> commits regardless
    throw new Error("commit failed"); // outer rolls back the tgz, not the audit
  }
}
