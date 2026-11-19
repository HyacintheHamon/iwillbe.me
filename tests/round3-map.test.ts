import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import { closeInterests, exploreInterests } from "../src/round3-map";

const interest = (title: string, state: string): Entry => ({
  ...entryInput("interest", title, { state }),
  id: title,
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
});

test("map exploration comes from Into it interests, never a passing or paused interest", () => {
  const practice = emptyPractice();
  practice.entries = [
    interest("hiking", "into_it"),
    interest("reading", "want_to_try"),
    interest("cooking for friends", "on_pause"),
    interest("playing music", "all_in"),
  ];
  const suggestions = exploreInterests(practice);
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((link) => link.interest === "hiking"));
  assert.ok(suggestions.every((link) => link.reason.trim()));
});

test("map visits rotate eligible suggestions while preserving library reasons and excluding existing interests", () => {
  const practice = emptyPractice();
  practice.entries = [
    interest("hiking", "into_it"),
    interest("cooking for friends", "into_it"),
    interest(" BAKING ", "on_pause"),
  ];
  const first = exploreInterests(practice, 0);
  const next = exploreInterests(practice, 1);
  assert.equal(first.length, 3);
  assert.equal(next.length, 3);
  assert.notDeepEqual(
    new Set(first.map((link) => link.similar_interest)),
    new Set(next.map((link) => link.similar_interest)),
  );
  assert.ok(
    [...first, ...next].every((link) => link.similar_interest !== "baking"),
  );
  assert.equal(
    new Set(first.map((link) => link.similar_interest)).size,
    first.length,
  );
});

test("an interest discovered through a link can itself offer a nearby interest without duplicating the map", () => {
  const practice = emptyPractice();
  practice.entries = [interest("baking", "want_to_try")];
  const nearby = closeInterests(practice, "baking");
  assert.ok(
    nearby.some((link) => link.similar_interest === "cooking for friends"),
  );
  practice.entries.push(interest("Cooking for friends", "from_time_to_time"));
  assert.ok(
    !closeInterests(practice, "baking").some(
      (link) => link.similar_interest === "cooking for friends",
    ),
  );
  assert.deepEqual(closeInterests(practice, "an unknown interest"), []);
});
