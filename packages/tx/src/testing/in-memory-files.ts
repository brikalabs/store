import type { FileStore } from "../adapters/storage";

/** A plain in-memory {@link FileStore}: dumb storage; {@link transactionalStorage} adds the rollback. */
export class InMemoryFiles implements FileStore {
  readonly objects = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.objects.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.objects.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }
}
