export type DraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: string[]): Promise<void>;
};
export const ownerDraftPrefix = (owner: string) => `iwillbe.draft.v1.${owner}.`;
type Lease = { owner: string; epoch: number; keyEpoch: number };

// A lease belongs to one mounted draft. Clearing an owner invalidates all old
// leases before waiting for pending writes, so a late callback cannot resurrect it.
export function createDraftStore(storage: DraftStorage) {
  const pending = new Map<string, Promise<unknown>>();
  const ownerEpoch = new Map<string, number>();
  const keyEpoch = new Map<string, number>();
  const clearing = new Map<string, Promise<void>>();
  const ownerOf = (key: string) =>
    key.slice("iwillbe.draft.v1.".length).split(".")[0];
  const lease = (key: string): Lease => {
    const owner = ownerOf(key);
    return {
      owner,
      epoch: ownerEpoch.get(owner) || 0,
      keyEpoch: keyEpoch.get(key) || 0,
    };
  };
  const valid = (key: string, token: Lease) =>
    token.epoch === (ownerEpoch.get(token.owner) || 0) &&
    token.keyEpoch === (keyEpoch.get(key) || 0);
  const enqueue = <T>(key: string, work: () => Promise<T>) => {
    const operation = (pending.get(key) || Promise.resolve())
      .catch(() => {})
      .then(work);
    pending.set(key, operation);
    void operation
      .finally(() => {
        if (pending.get(key) === operation) pending.delete(key);
      })
      .catch(() => {});
    return operation;
  };
  return {
    lease,
    valid,
    async read(key: string, token: Lease) {
      await clearing.get(token.owner);
      await pending.get(key)?.catch(() => {});
      return valid(key, token) ? storage.getItem(key) : null;
    },
    write(key: string, value: string, token: Lease) {
      const barrier = clearing.get(token.owner);
      return enqueue(key, async () => {
        await barrier;
        if (valid(key, token)) await storage.setItem(key, value);
      });
    },
    async clear(key: string) {
      keyEpoch.set(key, (keyEpoch.get(key) || 0) + 1);
      await enqueue(key, () => storage.removeItem(key));
    },
    async clearOwner(owner: string) {
      ownerEpoch.set(owner, (ownerEpoch.get(owner) || 0) + 1);
      const prefix = ownerDraftPrefix(owner);
      const previous = clearing.get(owner);
      // Capture only pre-invalidation writes. New stale callbacks wait for this
      // barrier, see their invalid lease, and cannot write after the removal.
      const oldWrites = [...pending]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, p]) => p);
      const clear = (async () => {
        await previous?.catch(() => {});
        await Promise.allSettled(oldWrites);
        const keys = (await storage.getAllKeys()).filter((key) =>
          key.startsWith(prefix),
        );
        if (keys.length) await storage.multiRemove(keys);
      })();
      clearing.set(owner, clear);
      try {
        await clear;
      } finally {
        if (clearing.get(owner) === clear) clearing.delete(owner);
      }
    },
  };
}
