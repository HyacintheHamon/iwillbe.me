import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice } from "../src/domain";
import {
  entryInput,
  interestState,
  valueState,
  rhythmDue,
  dayInZone,
  currentWhy,
  type Entry,
} from "../src/journey";
const e = (kind: Entry["kind"], title: string): Entry => ({
  ...entryInput(kind, title),
  id: "e",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
});
test("completion never invents energy or value conviction, and absence never dims interests", () => {
  const p = emptyPractice();
  const interest = e("interest", "Teaching"),
    value = e("value", "Patience");
  for (let n = 0; n < 3; n++) {
    p.intentions.push({
      id: String(n),
      day: `2026-01-0${n + 1}`,
      action: "Tutor",
      interest: "Teaching",
      value: "Patience",
      person: "",
      created_at: "",
    });
    p.checkIns.push({
      intention_id: String(n),
      outcome: "yes",
      reflection: "",
      created_at: `2026-01-0${n + 1}`,
    });
  }
  assert.equal(interestState(p, interest), "Spark");
  assert.equal(valueState(p, value), "Flicker");
  p.checkIns.forEach((c) => {
    c.energy = "lit";
    c.value_choice = "yes";
  });
  assert.equal(interestState(p, interest), "Blaze");
  assert.equal(valueState(p, value), "Steady");
  p.checkIns[2].value_choice = "not_mine";
  assert.equal(valueState(p, value), "Drift");
  assert.equal(interestState(p, { ...interest, state: "ember" }), "Ember");
  assert.equal(interestState(p, { ...interest, state: "craft" }), "Craft");
});
test("already loved is self report, and not-yet cannot count as a lived positive experience", () => {
  const p = emptyPractice();
  assert.equal(
    interestState(p, { ...e("interest", "Teaching"), state: "love" }),
    "Glow",
  );
  p.intentions = [
    {
      id: "a",
      day: "2026-01-01",
      action: "Tutor",
      value: "",
      interest: "Teaching",
      person: "",
      created_at: "",
    },
  ];
  p.checkIns = [
    {
      intention_id: "a",
      outcome: "not_yet",
      reflection: "",
      created_at: "",
      energy: "lit",
    },
  ];
  assert.equal(interestState(p, e("interest", "Teaching")), "Spark");
});
test("reviews deduplicate by the profile timezone and deferral, one primary rhythm at a time", () => {
  const p = emptyPractice();
  p.profile.timezone = "America/New_York";
  const now = new Date("2026-11-01T01:00:00Z");
  assert.equal(dayInZone(p.profile.timezone, now), "2026-10-31");
  assert.equal(rhythmDue(p, now)?.period, "moon:2026-10");
  p.entries = [
    {
      ...e("review", "Full Moon"),
      state: "done",
      meta: { period: "moon:2026-10" },
    },
  ];
  assert.equal(rhythmDue(p, now)?.kind, "weekly");
  p.entries.push({
    ...e("review", "Week"),
    state: "deferred",
    meta: { period: "week:2026-10-25", next_day: "2026-11-02" },
  });
  assert.equal(rhythmDue(p, now), null);
});
test("why proposals do not replace an accepted why", () => {
  const p = emptyPractice();
  p.entries = [
    { ...e("why", "Why"), id: "a", state: "accepted", body: "Help others." },
    {
      ...e("why", "Why"),
      id: "b",
      state: "proposed",
      body: "A suggestion",
      created_at: "2026-02-01",
    },
  ];
  assert.equal(currentWhy(p)?.id, "a");
});
