import type { Batchable } from "../adapters/orm";

/** A plain in-memory {@link Batchable}: records the statements committed via `batch`. */
export class FakeDb implements Batchable<string> {
  readonly committed: string[] = [];

  async batch(statements: readonly string[]): Promise<void> {
    this.committed.push(...statements);
  }

  has(statement: string): boolean {
    return this.committed.includes(statement);
  }
}
