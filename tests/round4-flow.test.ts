import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice, type Intention } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import { MISSIONS, missionFamilyId, selectMission } from "../src/round2";
import {
  focusKey,
  focusSentence,
  obstacleEvent,
  obstaclePlan,
  pendingFromEntry,
  priorityReviewDue,
  shouldAskObstacle,
  todayIdeas,
  tomorrowPrefill,
} from "../src/round4-flow";

const day = "2026-11-26";
const now = new Date(`${day}T09:00:00Z`);
const entry = (
  kind: Entry["kind"],
  title: string,
  fields: Partial<Entry> = {},
): Entry => ({
  ...entryInput(kind, title),
  id: `${kind}:${title}`,
  created_at: `${day}T08:00:00Z`,
  updated_at: `${day}T08:00:00Z`,
  ...fields,
});
const focus = (fields: Partial<Intention> = {}): Intention => ({
  id: "focus",
  day,
  action: "be patient with my kids",
  value: "patient",
  person: "with my kids",
  source: "typed",
  created_at: `${day}T08:00:00Z`,
  ...fields,
});

test("typed capitals survive display; priority suggestions include be exactly once", () => {
  assert.equal(
    focusSentence(focus({ action: "Call Mom after work" })),
    "I will Call Mom after work",
  );
  assert.equal(
    focusSentence(focus({ action: "I will help Mom" })),
    "I will help Mom",
  );
  assert.equal(
    focusSentence(
      focus({ action: "patient with my kids", source: "suggested" }),
    ),
    "I will be patient with my kids",
  );
  assert.equal(
    focusSentence(
      focus({ action: "be patient with my kids", source: "suggested" }),
    ),
    "I will be patient with my kids",
  );
});

test("three explicit wheels retain every constraint; impossible triples stay empty", () => {
  const practice = emptyPractice();
  practice.profile.timezone = "UTC";
  const example = MISSIONS.find(
    (m) =>
      m.level === "easy" &&
      m.interests.length &&
      m.places.length &&
      !m.ages?.length &&
      m.setting === "Home",
  )!;
  const options = {
    priority: example.priorities[0],
    where: "anywhere",
    kind: "anywhere",
    interest: example.interests[0],
    place: example.places[0],
    now,
    day,
  };
  const selected = selectMission(practice, options);
  assert.ok(selected.mission);
  assert.ok(selected.mission.interests.includes(options.interest));
  assert.ok(selected.mission.places.includes(options.place));
  const none = selectMission(practice, {
    ...options,
    interest: "unmatched custom interest",
  });
  assert.equal(none.mission, undefined);
  assert.equal(none.whereCleared, false);
});

test("Harder preserves family and Another idea excludes that whole family", () => {
  const practice = emptyPractice();
  practice.profile.timezone = "UTC";
  const options = {
    priority: "patient",
    where: "anywhere",
    kind: "anywhere",
    now,
    day,
  };
  const first = selectMission(practice, options);
  assert.ok(first.mission);
  const next = selectMission(practice, {
    ...options,
    familyId: first.familyId,
    level: "normal",
  });
  if (next.mission) assert.equal(missionFamilyId(next.mission), first.familyId);
  const another = selectMission(practice, {
    ...options,
    excludedFamilyIds: [first.familyId!],
  });
  assert.ok(another.mission);
  assert.notEqual(another.familyId, first.familyId);
  assert.equal(another.mission.level, "easy");
});

test("saved reminders wait for their local day and lead the idea list", () => {
  const practice = emptyPractice();
  practice.profile.timezone = "UTC";
  practice.entries = [
    entry("value", "patient", { state: "working_on" }),
    entry("interest", "reading", { state: "into_it" }),
    entry("preferences", "Action reminder", {
      body: "Call Mom",
      meta: {
        reminder_day: "2026-11-27",
        status: "open",
        created_from: "build_action",
      },
    }),
  ];
  assert.ok(
    !todayIdeas(practice, [], day, now).some(
      (idea) => idea.text === "Call Mom",
    ),
  );
  const tomorrow = todayIdeas(
    practice,
    [],
    "2026-11-27",
    new Date("2026-11-27T09:00:00Z"),
  );
  assert.equal(tomorrow[0].text, "Call Mom");
  assert.equal(tomorrow[0].label, "Your reminder");
  assert.equal(tomorrow[0].pending.text, "Call Mom");
  assert.ok(
    tomorrow.some(
      (idea) => idea.kind === "interest" && idea.stage === "Into it",
    ),
  );
  practice.entries[2].meta.status = "released";
  assert.ok(
    !todayIdeas(
      practice,
      [],
      "2026-11-27",
      new Date("2026-11-27T09:00:00Z"),
    ).some((idea) => idea.text === "Call Mom"),
  );
});

test("tomorrow choice prefills only its exact day and never creates an intention", () => {
  const practice = emptyPractice();
  practice.entries = [
    entry("preferences", "Tomorrow focus", {
      body: "Call Mom",
      meta: { reminder_day: "2026-11-27", prefill: true, status: "open" },
    }),
  ];
  assert.equal(tomorrowPrefill(practice, day), undefined);
  assert.equal(tomorrowPrefill(practice, "2026-11-27")?.body, "Call Mom");
  assert.equal(practice.intentions.length, 0);
  practice.entries[0].meta.status = "released";
  assert.equal(tomorrowPrefill(practice, "2026-11-27"), undefined);
});

test("a private mission reminder keeps its ID for owner-scoped validation at save time", () => {
  const reminder = entry("preferences", "Tomorrow focus", {
    body: "Practice one salsa step",
    meta: {
      mission_id: "AI-private-family-easy",
      level: "easy",
      interest: "salsa dancing",
    },
  });
  const pending = pendingFromEntry(reminder);
  assert.equal(pending.missionId, reminder.meta.mission_id);
  assert.equal(pending.source, "suggested");
  assert.equal(pending.level, "easy");
  assert.equal(pending.interest, "salsa dancing");
  assert.equal(
    focusKey(focus({ mission_id: "personal-owner-hash-5-minute" })),
    focusKey(focus({ mission_id: "personal-owner-hash-Normal" })),
  );
});

test("obstacle cooldown leaves a quiet night across mission sizes and different focuses", () => {
  const practice = emptyPractice();
  const current = focus({ mission_id: "GR-UNS-1b" });
  practice.entries = [
    entry("event", "Night obstacle", {
      meta: {
        focus_key: focusKey(focus({ mission_id: "GR-UNS-1a" })),
        focus_day: "2026-11-25",
        asked: true,
      },
    }),
  ];
  assert.equal(shouldAskObstacle(practice, current, "not_yet", day), false);
  assert.equal(shouldAskObstacle(practice, current, "partly", day), false);
  assert.equal(
    shouldAskObstacle(
      practice,
      focus({ mission_id: "GR-STA-1a" }),
      "not_yet",
      day,
    ),
    false,
  );
  practice.entries[0].meta.focus_day = "2026-11-24";
  assert.equal(shouldAskObstacle(practice, current, "not_yet", day), true);
  assert.equal(shouldAskObstacle(practice, current, "yes", day), false);
  assert.equal(
    shouldAskObstacle(
      emptyPractice(),
      current,
      "not_yet",
      day,
      "It was a hard day",
    ),
    false,
  );
  assert.equal(
    focusKey(focus({ action: "I will Call Mom." })),
    focusKey(focus({ action: "call   Mom" })),
  );
});

test("replacing a focus keeps its previous obstacle separate even if the daily ID is reused", () => {
  const practice = emptyPractice();
  const previous = focus({ action: "Call Mom" });
  practice.entries = [
    entry("event", "Night obstacle", {
      id: "previous-obstacle",
      body: "Ran out of time",
      meta: {
        focus_key: focusKey(previous),
        focus_day: day,
        intention_id: previous.id,
        asked: true,
        obstacle_reason: "time",
      },
    }),
  ];
  const replacement = focus({ action: "Go salsa dancing" });
  const next = obstacleEvent(practice, replacement, day);
  assert.notEqual(next.id, "previous-obstacle");
  assert.equal(next.meta.obstacle_reason, undefined);
  assert.equal(next.meta.focus_key, focusKey(replacement));
});

test("an early obstacle shrinks the chosen focus before offering an unrelated skill ladder", () => {
  const practice = emptyPractice();
  const current = focus({ action: "Call NASA about the API" });
  const time = obstaclePlan(practice, current, "time", "", day);
  assert.equal(time.mission, undefined);
  assert.equal(
    time.text,
    "Spend five minutes on one small part of: Call NASA about the API",
  );
  const big = obstaclePlan(practice, current, "big", "", day);
  assert.equal(big.mission, undefined);
  assert.match(big.text, /ten minutes.*Call NASA about the API/);
  const start = obstaclePlan(practice, current, "start", "", day);
  assert.equal(start.mission, undefined);
  assert.match(start.text, /first thing.*Call NASA about the API/);
});

test("third stall offers a skill ladder and hesitation never fabricates an action", () => {
  const practice = emptyPractice();
  practice.profile.timezone = "UTC";
  const current = focus({ mission_id: "GR-FIT-1a" });
  practice.intentions = [
    focus({ ...current, id: "one", day: "2026-11-24" }),
    focus({ ...current, id: "two", day: "2026-11-25" }),
    current,
  ];
  practice.checkIns = ["one", "two"].map((id) => ({
    intention_id: id,
    outcome: "not_yet",
    reflection: "",
    created_at: "2026-11-25T20:00:00Z",
  }));
  const plan = obstaclePlan(practice, current, "big", "", day);
  assert.equal(plan.stuck, true);
  assert.ok(plan.mission);
  assert.ok(
    ["Getting unstuck", "Starting now", "Rolling with change"].includes(
      plan.mission.ladder,
    ),
  );
  assert.equal(plan.mission.level, "easy");
  assert.equal(obstaclePlan(practice, current, "unsure", "", day).text, "");
  assert.equal(obstaclePlan(practice, current, "motivation", "", day).text, "");
});

test("priority review is occasional and based on lived focus days", () => {
  const practice = emptyPractice();
  practice.entries = [entry("value", "patient")];
  const current = focus();
  practice.intentions = [current];
  assert.equal(priorityReviewDue(practice, current), false);
  for (let i = 0; i < 4; i++) {
    practice.intentions.push(
      focus({ id: `old${i}`, day: `2026-11-${20 + i}` }),
    );
    practice.checkIns.push({
      intention_id: `old${i}`,
      outcome: "yes",
      reflection: "",
      created_at: `2026-11-${20 + i}T20:00:00Z`,
    });
  }
  assert.equal(priorityReviewDue(practice, current), true);
  practice.entries[0].meta.value_review_day = day;
  assert.equal(priorityReviewDue(practice, current), false);
});
