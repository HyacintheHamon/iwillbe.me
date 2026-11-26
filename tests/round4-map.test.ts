import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import { INTEREST_LINKS } from "../src/round2";
import {
  discoverInterests,
  discoveryHistory,
  discoveryTitles,
  growingInterests,
} from "../src/round4-map";

const interest = (title: string, state = "into_it"): Entry => ({
  ...entryInput("interest", title, { state }),
  id: title,
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
});

test("Round 4 discovery has two distinct groups and skips every interest already on the map", () => {
  const practice = emptyPractice();
  practice.entries = [
    interest("hiking"),
    interest("reading"),
    interest(" CAMPING ", "on_pause"),
  ];
  const groups = discoverInterests(practice, [], "2026-11-26");
  assert.equal(groups.close.length, 3);
  assert.equal(groups.different.length, 3);
  const titles = discoveryTitles(groups).map((title) => title.toLowerCase());
  assert.equal(new Set(titles).size, 6);
  assert.ok(
    !titles.some((title) => ["hiking", "reading", "camping"].includes(title)),
  );
  assert.ok(
    [...groups.close, ...groups.different].every(
      (idea) => idea.reason && idea.source,
    ),
  );
});

test("Other ideas refreshes both groups without repeating a card from the preceding set", () => {
  const practice = emptyPractice();
  practice.entries = [
    interest("hiking"),
    interest("reading"),
    interest("cooking for friends"),
  ];
  const first = discoverInterests(practice, [], "2026-11-26");
  const next = discoverInterests(
    practice,
    discoveryTitles(first),
    "2026-11-26:1",
  );
  assert.equal(next.close.length, 3);
  assert.equal(next.different.length, 3);
  assert.ok(
    discoveryTitles(next).every(
      (title) => !discoveryTitles(first).includes(title),
    ),
  );
  assert.ok(practice.entries.every((entry) => entry.state === "into_it"));
});

test("Close discovery widens one edge when the direct neighbours have been shown", () => {
  const practice = emptyPractice();
  practice.entries = [interest("hiking")];
  const direct = INTEREST_LINKS.flatMap((link) =>
    link.interest === "hiking"
      ? [link.similar_interest]
      : link.similar_interest === "hiking"
        ? [link.interest]
        : [],
  );
  const groups = discoverInterests(practice, direct, "2026-11-26");
  assert.equal(groups.close.length, 3);
  assert.ok(groups.close.every((idea) => !direct.includes(idea.title)));
  assert.ok(
    groups.close.every((idea) => idea.reason.startsWith("One step from ")),
  );
});

test("Passing suggestions gives a seven-day cooldown without changing map stages", () => {
  const practice = emptyPractice();
  practice.entries = [
    {
      ...entryInput("preferences", "Interest discovery", {
        meta: { blocks: ["camping", "baking"], last_shown_day: "2026-11-20" },
      }),
      id: "discovery-history",
      created_at: "2026-11-20T09:00:00Z",
      updated_at: "2026-11-20T09:00:00Z",
    },
  ];
  assert.deepEqual(discoveryHistory(practice, "2026-11-26"), [
    "camping",
    "baking",
  ]);
  assert.deepEqual(discoveryHistory(practice, "2026-11-27"), []);
  assert.deepEqual(discoveryHistory(practice, "2026-11-19"), []);
});

test("Growing wheel leads with Into it, then From time to time and Want to try, retaining All in and On pause", () => {
  const practice = emptyPractice();
  practice.entries = [
    interest("singing", "all_in"),
    interest("camping", "want_to_try"),
    interest("running", "on_pause"),
    interest("baking", "from_time_to_time"),
    interest("hiking", "into_it"),
  ];
  assert.deepEqual(
    growingInterests(practice).map((entry) => entry.title),
    ["hiking", "baking", "camping", "singing", "running"],
  );
});
