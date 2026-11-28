import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice, type Practice } from "../src/domain";
import {
  entryInput,
  type Entry,
  type EntryInput,
  REVIEW_QUESTIONS,
  valueState,
} from "../src/journey";
import {
  followupInput,
  keptPriorityCount,
  nightFollowup,
  openFollowupInput,
  sundayOnboardingPhase,
  isShortOnboardingSunday,
} from "../src/onboarding-followups";
const entry = (input: EntryInput, id = input.id || input.title): Entry => ({
  ...input,
  id,
  created_at: "2026-11-27T14:00:00Z",
  updated_at: "2026-11-27T14:00:00Z",
});
const practice = () => {
  const p = emptyPractice();
  p.entries.push(
    entry(
      entryInput("preferences", "Onboarding schedule", {
        meta: { version: "one-minute-v1", completed_day: "2026-11-27" },
      }),
    ),
  );
  return p;
};
const record = (
  p: Practice,
  key: string,
  day: string,
  status: "shown" | "answered" | "skipped" = "answered",
) => {
  p.entries.push(
    entry(followupInput(p, key, `Question for ${key}`, day, status), key),
  );
};

test("a new account gets reminders first and places on a later local night", () => {
  const p = practice();
  assert.equal(nightFollowup(p, "2026-11-27")?.kind, "reminders");
  record(p, "reminders", "2026-11-27");
  assert.equal(nightFollowup(p, "2026-11-27"), null);
  assert.equal(nightFollowup(p, "2026-11-28")?.kind, "places");
});
test("a shown reservation survives reload without revealing a second question", () => {
  const p = practice();
  record(p, "reminders", "2026-11-27", "shown");
  assert.equal(nightFollowup(p, "2026-11-27")?.key, "reminders");
  p.entries.find((item) => item.id === "reminders")!.meta.followup_status =
    "skipped";
  assert.equal(nightFollowup(p, "2026-11-27"), null);
  assert.equal(nightFollowup(p, "2026-11-28")?.key, "places");
});
test("a skipped follow-up is an Open Question with a cooldown", () => {
  const p = practice();
  const task = nightFollowup(p, "2026-11-27")!;
  const saved = openFollowupInput(p, task, "2026-11-27");
  assert.equal(saved.kind, "question");
  assert.equal(saved.state, "open");
  assert.equal(saved.meta.next_day, "2026-12-04");
});
test("interest stage requires relevant onboarding interest and is asked only once within 14 days", () => {
  const p = practice();
  record(p, "reminders", "2026-11-27");
  record(p, "places", "2026-11-28");
  p.entries.push(
    entry(
      entryInput("interest", "hiking", {
        state: "want_to_try",
        meta: { onboarding_session: "one-minute-v1" },
      }),
      "hiking",
    ),
  );
  assert.equal(nightFollowup(p, "2026-11-29"), null);
  assert.equal(
    nightFollowup(p, "2026-11-29", undefined, "I enjoyed hiking")?.key,
    "interest:hiking",
  );
  assert.equal(nightFollowup(p, "2026-12-11", undefined, "hiking"), null);
  record(p, "interest:hiking", "2026-11-29", "skipped");
  assert.equal(nightFollowup(p, "2026-11-30", undefined, "hiking"), null);
});
test("five explicit Keep it decisions invite confirmation; completion alone never promotes", () => {
  const p = emptyPractice();
  const priority = entry(
    entryInput("value", "patient", { state: "working_on" }),
    "patience",
  );
  p.entries.push(priority);
  for (let n = 0; n < 5; n++) {
    const id = `focus-${n}`;
    p.intentions.push({
      id,
      day: `2026-11-${20 + n}`,
      action: "Listen",
      value: "patient",
      value_id: priority.id,
      person: "",
      created_at: "2026-11-20T10:00:00Z",
    });
    p.checkIns.push({
      intention_id: id,
      outcome: "yes",
      reflection: "",
      created_at: "2026-11-20T21:00:00Z",
    });
  }
  assert.equal(nightFollowup(p, "2026-11-27"), null);
  p.checkIns.forEach((check) => (check.value_choice = "yes"));
  assert.equal(keptPriorityCount(p, priority), 5);
  assert.equal(valueState(p, priority), "Working on");
  assert.match(
    nightFollowup(p, "2026-11-27")!.question,
    /^Patience keeps showing up/,
  );
  record(p, "priority:patience", "2026-11-27", "skipped");
  assert.equal(nightFollowup(p, "2026-11-28"), null);
});
test("a saved map question defers the fifth-Keep-it promotion through reload until a later night", () => {
  const p = emptyPractice();
  const priority = entry(
    entryInput("value", "patient", { state: "working_on" }),
    "patience",
  );
  p.entries.push(priority);
  for (let n = 0; n < 5; n++) {
    const id = `focus-${n}`;
    p.intentions.push({
      id,
      day: n === 4 ? "2026-11-27" : `2026-11-${20 + n}`,
      action: "Listen",
      value: "patient",
      value_id: priority.id,
      person: "",
      created_at: "2026-11-20T10:00:00Z",
    });
    p.checkIns.push({
      intention_id: id,
      outcome: "yes",
      value_choice: "yes",
      reflection: "",
      created_at: "2026-11-27T21:00:00Z",
    });
  }
  assert.equal(nightFollowup(p, "2026-11-27")?.key, "priority:patience");
  record(p, "night-map:2026-11-27", "2026-11-27", "answered");
  const reloaded = JSON.parse(JSON.stringify(p)) as Practice;
  assert.equal(keptPriorityCount(reloaded, priority), 5);
  assert.equal(nightFollowup(reloaded, "2026-11-27"), null);
  assert.equal(nightFollowup(reloaded, "2026-11-28")?.key, "priority:patience");
  assert.equal(valueState(reloaded, priority), "Working on");
});
test("first and second Sundays are separate reviews and missed Sundays retain the baseline", () => {
  const p = practice();
  assert.equal(sundayOnboardingPhase(p, "2026-11-28"), null);
  assert.equal(sundayOnboardingPhase(p, "2026-11-29"), 1);
  assert.equal(sundayOnboardingPhase(p, "2026-12-06"), 1);
  record(p, "sunday:1", "2026-12-06");
  assert.equal(sundayOnboardingPhase(p, "2026-12-06"), null);
  assert.equal(isShortOnboardingSunday(p, "2026-12-06"), true);
  assert.equal(sundayOnboardingPhase(p, "2026-12-13"), 2);
  record(p, "sunday:2", "2026-12-13");
  assert.equal(sundayOnboardingPhase(p, "2026-12-20"), null);
  assert.equal(isShortOnboardingSunday(p, "2026-12-20"), false);
});
test("existing accounts are not replayed through a new onboarding schedule", () => {
  const p = emptyPractice();
  p.profile.onboarded = true;
  assert.equal(nightFollowup(p, "2026-11-29"), null);
  assert.equal(sundayOnboardingPhase(p, "2026-11-29"), null);
});
test("baseline uses the same authoritative questions as monthly review", () => {
  assert.equal(
    REVIEW_QUESTIONS[0],
    "How much did this month feel like it was heading where you want to go?",
  );
  assert.equal(REVIEW_QUESTIONS.length, 3);
});
