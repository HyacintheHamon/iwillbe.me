import test from "node:test";
import assert from "node:assert/strict";
import type { Entry } from "../src/journey";
import {
  legacyPickOwnership,
  pickKey,
  pickSource,
  quickPickChanges,
} from "../src/onboarding-picks";

const card = {
  id: "ceramics",
  title: "Ceramics",
  description: "Shape something with your hands.",
  domain: "Making",
};
const owned = (changes: Partial<Entry> = {}): Entry => ({
  id: "created-here",
  kind: "interest",
  title: card.title,
  body: card.description,
  state: "spark",
  source: pickSource("spark"),
  source_ids: [],
  created_at: "2026-10-26T10:00:00Z",
  updated_at: "2026-10-26T10:00:00Z",
  meta: {
    onboarding_session: "this-session",
    onboarding_key: pickKey(card.id),
  },
  ...changes,
});
const input = (choice: string, entries = [owned()]) => ({
  cards: [card],
  choices: { ceramics: choice },
  entries,
  session: "this-session",
  snapshots: {
    ceramics: { id: "created-here", updated_at: "2026-10-26T10:00:00Z" },
  },
  used: [],
});

test("a saved Curious pick can become Already love and remains idempotent", () => {
  const changes = quickPickChanges(input("love"));
  assert.equal(changes.length, 1);
  assert.equal(changes[0].operation, "update");
  assert.equal(changes[0].entry?.id, "created-here");
  assert.equal(changes[0].state, "love");
  assert.deepEqual(
    quickPickChanges(
      input("love", [owned({ state: "love", source: pickSource("love") })]),
    ),
    [],
  );
});

test("undo or Not for me removes only a pick owned by this unfinished session", () => {
  for (const choice of ["pass", ""])
    assert.equal(quickPickChanges(input(choice))[0].operation, "remove");
  for (const entry of [
    owned({ meta: {} }),
    owned({
      meta: {
        onboarding_session: "another-session",
        onboarding_key: pickKey(card.id),
      },
    }),
    owned({ source: "Chosen by you", body: "My own notes" }),
    owned({ state: "tried" }),
  ]) {
    assert.deepEqual(quickPickChanges(input("pass", [entry])), []);
    assert.deepEqual(quickPickChanges(input("love", [entry])), []);
  }
});

test("quick-pick edits cannot undo later practice or changes in Possibilities", () => {
  assert.deepEqual(
    quickPickChanges({
      ...input("pass"),
      used: [{ interest_id: "created-here" }],
    }),
    [],
  );
  assert.deepEqual(
    quickPickChanges({
      ...input("pass"),
      used: [{ interest: "Ceramics", interest_id: null }],
    }),
    [],
  );
  assert.deepEqual(
    quickPickChanges(
      input("pass", [owned({ updated_at: "2026-10-26T11:00:00Z" })]),
    ),
    [],
  );
});

test("preexisting interests are preserved without duplicate creation", () => {
  assert.deepEqual(
    quickPickChanges(
      input("love", [
        owned({
          id: "old",
          title: "ceramics",
          meta: {},
          source: "Chosen by you",
        }),
      ]),
    ),
    [],
  );
  assert.equal(quickPickChanges(input("curious", []))[0].operation, "create");
  assert.deepEqual(quickPickChanges(input("pass", [])), []);
});

test("migration recognizes only exact old unfinished quick picks", () => {
  const old = owned({ meta: {} });
  const migration = {
    cards: [card],
    choices: { ceramics: "curious" },
    entries: [old],
    onboarded: false,
    used: [],
  };
  assert.deepEqual(legacyPickOwnership(migration), [
    { card: "ceramics", id: old.id, updated_at: old.updated_at },
  ]);
  assert.deepEqual(legacyPickOwnership({ ...migration, onboarded: true }), []);
  assert.deepEqual(
    legacyPickOwnership({ ...migration, used: [{ interest_id: old.id }] }),
    [],
  );
  assert.deepEqual(
    legacyPickOwnership({
      ...migration,
      entries: [owned({ meta: {}, source: "Chosen by you" })],
    }),
    [],
  );
  assert.deepEqual(
    legacyPickOwnership({ ...migration, choices: { ceramics: "love" } }),
    [],
  );
});
