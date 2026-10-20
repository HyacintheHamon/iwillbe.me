import test from "node:test";
import assert from "node:assert/strict";
import {
  activityCount,
  emptyPractice,
  localDay,
  shiftDay,
  nextIntentionDay,
  matchesDimension,
  importConflicts,
  hasPractice,
} from "../src/domain";
test("galaxy grows only from real-world action and cannot double count one reflection", () => {
  const p = emptyPractice();
  p.intentions = [
    {
      id: "a",
      day: "2026-10-19",
      action: "Listen",
      value: "Patience",
      person: "Sam",
      created_at: "",
    },
  ];
  assert.equal(activityCount(p, "Patience"), 0);
  p.checkIns = [
    { intention_id: "a", outcome: "not_yet", reflection: "", created_at: "" },
  ];
  assert.equal(activityCount(p, "Patience"), 0);
  p.checkIns[0].outcome = "partly";
  assert.equal(activityCount(p, "Patience"), 1);
  p.checkIns.push({ ...p.checkIns[0] });
  assert.equal(activityCount(p, "Patience"), 1);
  assert.equal(activityCount(p, "Curiosity"), 0);
});
test("daily intention uses local calendar day, not the UTC date", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/New_York";
  assert.equal(localDay(new Date("2026-10-20T00:30:00Z")), "2026-10-19");
  assert.equal(localDay(new Date("2026-11-01T06:30:00Z")), "2026-11-01");
  process.env.TZ = old;
});

test("tomorrow follows calendar boundaries including DST and year changes", () => {
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2026-11-01", 1), "2026-11-02");
  assert.equal(shiftDay("2026-03-08", -1), "2026-03-07");
});
test("a reflected day proposes tomorrow without replacing today's moment", () => {
  const p = emptyPractice();
  p.intentions = [
    {
      id: "a",
      day: "2026-10-19",
      action: "Listen",
      value: "Connection",
      person: "Sam",
      created_at: "",
    },
  ];
  assert.equal(nextIntentionDay(p, "2026-10-19"), "2026-10-19");
  p.checkIns = [
    { intention_id: "a", outcome: "not_yet", reflection: "", created_at: "" },
  ];
  assert.equal(nextIntentionDay(p, "2026-10-19"), "2026-10-20");
  assert.equal(p.intentions.length, 1);
});
test("galaxy links explicit values, activities and people, including legacy activities", () => {
  const i = {
    id: "a",
    day: "2026-10-19",
    action: "Cook together",
    value: "Connection",
    interest: "Cooking",
    person: "Sam",
    created_at: "",
  };
  assert.equal(matchesDimension(i, "value", "Connection"), true);
  assert.equal(matchesDimension(i, "interest", "Cooking"), true);
  assert.equal(matchesDimension(i, "person", "Sam"), true);
  assert.equal(matchesDimension(i, "person", "Alex"), false);
  const legacy = { ...i, value: "Cooking", interest: undefined };
  assert.equal(matchesDimension(legacy, "interest", "Cooking"), true);
  assert.equal(matchesDimension(legacy, "value", "Cooking"), false);
});
test("import review detects same-day conflicts but excludes already imported IDs", () => {
  const local = emptyPractice(),
    account = emptyPractice();
  const i = {
    id: "a",
    day: "2026-10-19",
    action: "Listen",
    value: "Presence",
    person: "",
    created_at: "",
  };
  local.intentions = [i];
  account.intentions = [{ ...i, id: "b" }];
  assert.equal(importConflicts(local, account).length, 1);
  account.intentions = [i];
  assert.equal(importConflicts(local, account).length, 0);
  assert.equal(hasPractice(local), true);
  assert.equal(hasPractice(emptyPractice()), false);
});
