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
  suggestedPlanet,
  returningToPractice,
  formatCommitment,
  whyRevisitDue,
  weeklyNotices,
  allInEligible,
  availableQuestion,
  questionAvailable,
  eligibleOpenQuestion,
  type Entry,
} from "../src/journey";
const e = (kind: Entry["kind"], title: string): Entry => ({
  ...entryInput(kind, title),
  id: "e",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
});

test("an old Maybe does not become eligible for All in when it has only just become Into it", () => {
  const p = emptyPractice();
  p.profile.timezone = "UTC";
  const interest = {
    ...e("interest", "Teaching"),
    state: "into_it",
    updated_at: "2026-10-25T20:00:00Z",
  };
  assert.equal(allInEligible(p, interest, "2026-10-26"), false);
  interest.meta.into_it_since = "2026-10-01T20:00:00Z";
  assert.equal(allInEligible(p, interest, "2026-10-26"), true);
  assert.equal(
    allInEligible(p, { ...interest, state: "paused" }, "2026-10-26"),
    false,
  );
  assert.equal(
    allInEligible(
      p,
      { ...interest, meta: { into_it_since: "not a date" } },
      "2026-10-26",
    ),
    false,
  );
});

test("derived Into it begins at the second positive reflection, not the original curiosity or first try", () => {
  const p = emptyPractice();
  p.profile.timezone = "UTC";
  const interest = e("interest", "Teaching");
  p.intentions = ["a", "b"].map((id, n) => ({
    id,
    day: `2026-09-0${n + 1}`,
    action: "Tutor",
    interest: "Teaching",
    value: "",
    person: "",
    created_at: `2026-09-0${n + 1}T12:00:00Z`,
  }));
  p.checkIns = ["a", "b"].map((id, n) => ({
    intention_id: id,
    outcome: "yes",
    energy: "lit",
    reflection: "",
    created_at: n ? "2026-10-25T20:00:00Z" : "2026-09-01T20:00:00Z",
  }));
  assert.equal(interestState(p, interest), "Into it");
  assert.equal(allInEligible(p, interest, "2026-10-26"), false);
  assert.equal(allInEligible(p, interest, "2026-11-08"), true);
});

test("night prompt selection honors stopped, deferred, same-session, and immediately previous questions", () => {
  const p = emptyPractice();
  p.profile.timezone = "America/New_York";
  p.entries = [
    { ...e("question", "What lit you up?"), id: "stopped", state: "stopped" },
    {
      ...e("question", "What did you practice, and what did you learn?"),
      id: "later",
      state: "open",
      meta: { next_day: "2026-10-27" },
    },
    {
      ...e("question", "What caught your interest today?"),
      id: "session",
      state: "open",
      meta: { last_asked_session: "night:2026-10-26" },
    },
    {
      ...e("preferences", "Check-in session"),
      id: "preferences",
      meta: { last_question: "What are you proud of today?" },
    },
  ];
  const candidates = [
    "What lit you up?",
    "What did you practice, and what did you learn?",
    "What caught your interest today?",
    "What are you proud of today?",
    "When did time fly today?",
  ];
  assert.equal(
    availableQuestion(p, candidates, "2026-10-26", "night:2026-10-26"),
    "When did time fly today?",
  );
  p.entries.push({
    ...e("question", "When did time fly today?"),
    state: "stopped",
  });
  assert.equal(
    availableQuestion(p, candidates, "2026-10-26", "night:2026-10-26"),
    "",
  );
  assert.equal(
    questionAvailable(
      p,
      "What did you practice, and what did you learn?",
      "2026-10-27",
      "night:2026-10-27",
    ),
    true,
  );
});

test("eligible Open Questions exclude answered items and an explicit reopen supersedes an older stopped copy", () => {
  const p = emptyPractice();
  p.entries = [
    { ...e("question", "What lit you up?"), id: "old", state: "stopped" },
    {
      ...e("question", "What lit you up?"),
      id: "new",
      state: "open",
      updated_at: "2026-10-20T12:00:00Z",
    },
    {
      ...e("question", "Who do you admire?"),
      id: "answered",
      state: "answered",
    },
  ];
  assert.equal(questionAvailable(p, "What lit you up?", "2026-10-26"), true);
  assert.equal(eligibleOpenQuestion(p, "2026-10-26")?.id, "new");
});

test("a deferred or stopped All in question is not immediately replaced by a paraphrase", () => {
  const p = emptyPractice();
  const questions = [
    "What did you practice, and what did you learn?",
    "What did today’s practice teach you?",
  ];
  p.entries = [
    {
      ...e("question", questions[0]),
      state: "open",
      meta: { next_day: "2026-10-28" },
    },
  ];
  assert.equal(
    availableQuestion(p, questions, "2026-10-26", "night:2026-10-26", true),
    "",
  );
  p.entries[0].state = "stopped";
  assert.equal(
    availableQuestion(p, questions, "2026-11-01", "night:2026-11-01", true),
    "",
  );
  p.entries[0].state = "answered";
  p.entries[0].meta = {};
  assert.equal(
    availableQuestion(p, questions, "2026-11-01", "night:2026-11-01", true),
    questions[0],
  );
});

test("quarterly due dates clamp month ends in the profile timezone", () => {
  const p = emptyPractice();
  p.profile.timezone = "America/New_York";
  p.entries = [
    {
      ...e("why", "My why"),
      state: "accepted",
      created_at: "2026-09-01T01:00:00Z",
    },
  ];
  assert.equal(whyRevisitDue(p, "2026-11-29"), false);
  assert.equal(whyRevisitDue(p, "2026-11-30"), true);
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
  assert.equal(interestState(p, interest), "Tried it");
  assert.equal(valueState(p, value), "Trying it on");
  p.checkIns.forEach((c) => {
    c.energy = "lit";
    c.value_choice = "yes";
  });
  assert.equal(interestState(p, interest), "Into it");
  assert.equal(valueState(p, value), "Mine");
  p.checkIns[2].value_choice = "not_mine";
  assert.equal(valueState(p, value), "Let go");
  assert.equal(interestState(p, { ...interest, state: "ember" }), "On pause");
  assert.equal(interestState(p, { ...interest, state: "craft" }), "All in");
});
test("already loved is self report, and not-yet cannot count as a lived positive experience", () => {
  const p = emptyPractice();
  assert.equal(
    interestState(p, { ...e("interest", "Teaching"), state: "love" }),
    "Into it",
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
  assert.equal(interestState(p, e("interest", "Teaching")), "Maybe");
});
test("monthly reviews wait until a later month; Sunday invitations use the profile timezone", () => {
  const p = emptyPractice();
  p.profile.timezone = "America/New_York";
  const now = new Date("2026-11-01T01:00:00Z");
  assert.equal(dayInZone(p.profile.timezone, now), "2026-10-31");
  assert.equal(rhythmDue(p, now), null);
  p.entries = [e("story", "A first story")];
  assert.equal(rhythmDue(p, now)?.period, "moon:2026-10");
  p.entries.push({
    ...e("review", "Monthly check-in"),
    state: "done",
    meta: { period: "moon:2026-10" },
  });
  assert.equal(rhythmDue(p, now), null);
  const sunday = new Date("2026-11-01T18:00:00Z");
  p.entries.push({
    ...e("review", "Monthly check-in"),
    state: "deferred",
    meta: { period: "moon:2026-11", next_day: "2026-11-03" },
  });
  assert.equal(rhythmDue(p, sunday)?.period, "week:2026-11-01");
  p.entries.push({
    ...e("review", "Sunday Explore"),
    state: "deferred",
    meta: { period: "week:2026-11-01", next_day: "2026-11-03" },
  });
  assert.equal(rhythmDue(p, sunday), null);
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

test("focus on one area overrides rotation, while guidance uses only the areas in the latest future picture", () => {
  const p = emptyPractice();
  p.entries = [
    {
      ...e("vision", "One year out"),
      meta: {
        horizon: "year",
        planet_notes: { Passions: "More drawing", Grow: "Learn French" },
      },
    },
  ];
  p.intentions = [
    {
      id: "a",
      day: "2026-10-25",
      action: "Draw",
      value: "",
      person: "me",
      planet: "Passions",
      created_at: "2026-10-25T12:00:00Z",
    },
  ];
  assert.equal(suggestedPlanet(p, "2026-10-26"), "Grow");
  p.entries.push({
    ...e("preferences", "Season"),
    meta: { pace: "stay", orbit: "Be" },
  });
  assert.equal(suggestedPlanet(p, "2026-10-26"), "Be");
  p.entries[p.entries.length - 1].meta = { pace: "vary" };
  assert.equal(suggestedPlanet(p, "2026-10-26"), "Grow");
});
test("return welcome ends after a real new check-in, without depending on a future intention's target day", () => {
  const p = emptyPractice();
  p.profile.timezone = "UTC";
  p.intentions = [
    {
      id: "a",
      day: "2026-10-24",
      action: "Draw",
      value: "",
      person: "",
      created_at: "2026-10-22T12:00:00Z",
    },
  ];
  assert.equal(returningToPractice(p, "2026-10-26"), true);
  p.entries.push({
    ...e("preferences", "Check-in session"),
    meta: { last_check_in_at: "2026-10-26T10:00:00Z" },
  });
  assert.equal(returningToPractice(p, "2026-10-26"), false);
});
test("commitments normalize wishes and do not duplicate I will or be", () => {
  assert.equal(
    formatCommitment("I hope to be patient", "be"),
    "I will be patient",
  );
  assert.equal(
    formatCommitment("I will try to be patient", "be"),
    "I will be patient",
  );
  assert.equal(
    formatCommitment("I'll try to call my aunt"),
    "I will call my aunt",
  );
  assert.equal(formatCommitment("I will be kind", "be"), "I will be kind");
  assert.equal(formatCommitment("Read a book"), "I will read a book");
});
test("why revisits are based on elapsed months and record a completed revisit", () => {
  const p = emptyPractice();
  p.entries = [
    {
      ...e("why", "My why"),
      state: "accepted",
      created_at: "2026-07-26T10:00:00Z",
    },
  ];
  assert.equal(whyRevisitDue(p, "2026-10-25"), false);
  assert.equal(whyRevisitDue(p, "2026-10-26"), true);
  p.entries.push({
    ...e("review", "Why revisit"),
    meta: { why_revisited_at: "2026-10-26T10:00:00Z" },
  });
  assert.equal(whyRevisitDue(p, "2026-10-27"), false);
});
test("weekly observations never claim energy or showing up from an uncompleted action", () => {
  const p = emptyPractice();
  p.intentions = [
    {
      id: "a",
      day: "2026-10-25",
      action: "Call Dad",
      value: "Kindness",
      person: "Dad",
      created_at: "2026-10-25T12:00:00Z",
    },
  ];
  p.checkIns = [
    {
      intention_id: "a",
      outcome: "not_yet",
      reflection: "",
      energy: "lit",
      value_choice: "yes",
      created_at: "2026-10-25T22:00:00Z",
    },
  ];
  assert.deepEqual(weeklyNotices(p, "2026-10-26"), []);
  p.checkIns[0].outcome = "yes";
  assert(weeklyNotices(p, "2026-10-26").some((n) => n.text.includes("Dad")));
});
test("an explicit value retry supersedes an older release", () => {
  const p = emptyPractice();
  const value = {
    ...e("value", "Patience"),
    state: "trying",
    updated_at: "2026-10-26T12:00:00Z",
  };
  p.intentions = [
    {
      id: "a",
      day: "2026-10-25",
      action: "Listen",
      value: "Patience",
      person: "",
      created_at: "2026-10-25T10:00:00Z",
    },
  ];
  p.checkIns = [
    {
      intention_id: "a",
      outcome: "yes",
      value_choice: "not_mine",
      reflection: "",
      created_at: "2026-10-25T22:00:00Z",
    },
  ];
  assert.equal(valueState(p, value), "Trying it on");
});

test("explicit weekly consent can introduce a new area while fixed focus and rotation remain respected", () => {
  const p = emptyPractice();
  p.entries = [
    {
      ...e("vision", "One year out"),
      meta: {
        horizon: "year",
        planet_notes: { People: "More time with family" },
      },
    },
    {
      ...e("preferences", "Weekly focus"),
      meta: { focus_area: "Grow", focus_until: "2026-11-01" },
    },
  ];
  assert.equal(suggestedPlanet(p, "2026-10-26"), "Grow");
  p.entries.push({ ...e("preferences", "Season"), meta: { pace: "vary" } });
  assert.equal(suggestedPlanet(p, "2026-10-26"), "Grow");
  p.intentions = [
    {
      id: "a",
      day: "2026-10-26",
      action: "Learn",
      value: "",
      person: "",
      planet: "Grow",
      created_at: "2026-10-26T12:00:00Z",
    },
  ];
  assert.notEqual(suggestedPlanet(p, "2026-10-27"), "Grow");
  p.entries[p.entries.length - 1].meta = { pace: "stay", orbit: "Be" };
  assert.equal(suggestedPlanet(p, "2026-10-27"), "Be");
});
