import assert from "node:assert/strict";
import test from "node:test";
import { createDraftStore, type DraftStorage } from "../src/draft-store";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function memoryStorage(seed: [string, string][] = []) {
  const values = new Map(seed);
  const storage: DraftStorage = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
    async getAllKeys() {
      return [...values.keys()];
    },
    async multiRemove(keys) {
      keys.forEach((key) => values.delete(key));
    },
  };
  return { values, storage };
}
const accountKey = "iwillbe.draft.v1.account-a.chloe";
const guestKey = "iwillbe.draft.v1.guest.chloe";

test(
  "account cleanup drains an in-flight write and rejects late callbacks while preserving guest and other accounts",
  { timeout: 2000 },
  async () => {
    const { values, storage } = memoryStorage([
      [guestKey, "guest backup"],
      ["iwillbe.draft.v1.account-b.chloe", "another account"],
      ["iwillbe.draft.v1.account-a.profile", "private preferences"],
    ]);
    const started = deferred(),
      finish = deferred();
    storage.setItem = async (key, value) => {
      if (value === "in flight") {
        started.resolve();
        await finish.promise;
      }
      values.set(key, value);
    };
    const store = createDraftStore(storage),
      old = store.lease(accountKey);
    const inFlight = store.write(accountKey, "in flight", old);
    await started.promise;
    const cleaning = store.clearOwner("account-a");
    const stale = store.write(accountKey, "late callback", old);
    finish.resolve();
    await Promise.all([inFlight, cleaning, stale]);
    await store.write(accountKey, "even later callback", old);
    assert.equal(values.has(accountKey), false);
    assert.equal(values.has("iwillbe.draft.v1.account-a.profile"), false);
    assert.equal(values.get(guestKey), "guest backup");
    assert.equal(
      values.get("iwillbe.draft.v1.account-b.chloe"),
      "another account",
    );
  },
);

test(
  "a new owner lease waits for removal and can save after sign-in again",
  { timeout: 2000 },
  async () => {
    const { values, storage } = memoryStorage([
      [accountKey, "old private draft"],
    ]);
    const started = deferred(),
      finish = deferred();
    storage.multiRemove = async (keys) => {
      started.resolve();
      await finish.promise;
      keys.forEach((key) => values.delete(key));
    };
    const store = createDraftStore(storage);
    const clearing = store.clearOwner("account-a");
    await started.promise;
    const fresh = store.write(
      accountKey,
      "new session",
      store.lease(accountKey),
    );
    finish.resolve();
    await Promise.all([clearing, fresh]);
    assert.equal(values.get(accountKey), "new session");
  },
);

test(
  "saving a screen clears its draft even when a previous write completes late",
  { timeout: 2000 },
  async () => {
    const { values, storage } = memoryStorage();
    const started = deferred(),
      finish = deferred();
    storage.setItem = async (key, value) => {
      started.resolve();
      await finish.promise;
      values.set(key, value);
    };
    const store = createDraftStore(storage),
      old = store.lease(accountKey);
    const write = store.write(accountKey, "outstanding draft", old);
    await started.promise;
    const clear = store.clear(accountKey);
    const stale = store.write(accountKey, "stale autosave", old);
    finish.resolve();
    await Promise.all([write, clear, stale]);
    assert.equal(values.has(accountKey), false);
  },
);

test("a failed autosave does not prevent later saves or owner cleanup", async () => {
  const { values, storage } = memoryStorage();
  let fail = true;
  storage.setItem = async (key, value) => {
    if (fail) {
      fail = false;
      throw new Error("Storage temporarily unavailable");
    }
    values.set(key, value);
  };
  const store = createDraftStore(storage),
    token = store.lease(accountKey);
  await assert.rejects(store.write(accountKey, "first", token));
  await store.write(accountKey, "second", token);
  assert.equal(await store.read(accountKey, token), "second");
  await store.clearOwner("account-a");
  assert.equal(values.has(accountKey), false);
});
