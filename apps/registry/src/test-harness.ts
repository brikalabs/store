/** Registry test harness: shared D1 fixtures re-exported, plus a registry-local R2 fake. */
export { makeDb, seedExamplePackage } from "@brika/store-db/test-harness";

/** Minimal in-memory R2 bucket: only the get/put/delete the adapters use. */
export function fakeR2(): R2Bucket {
  const store = new Map<string, Uint8Array>();
  const bucket = {
    get: async (key: string) => {
      const bytes = store.get(key);
      return bytes === undefined ? null : { body: new Response(bytes).body };
    },
    put: async (key: string, value: Uint8Array) => {
      store.set(key, value);
      return {};
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
  return bucket as unknown as R2Bucket;
}
