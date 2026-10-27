import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice, type Intention, type Practice } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import {
  featuredWhyEvidence,
  intentionConnectsToWhy,
  morningCue,
  nightInsight,
  proposeAreaMap,
  quarterStart,
  weeklyPossibility,
  whyEvidence,
  whyThreads,
} from "../src/guidance";
const entry = (
  kind: Entry["kind"],
  title: string,
  extra: Partial<Entry> = {},
): Entry => ({
  ...entryInput(kind, title),
  id: title,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  ...extra,
});
const moment = (
  id: string,
  day: string,
  extra: Partial<Intention> = {},
): Intention => ({
  id,
  day,
  action: "Make a little time",
  value: "",
  person: "me",
  created_at: `${day}T12:00:00Z`,
  ...extra,
});
function lived(
  p: Practice,
  intention: Intention,
  energy: "lit" | "neutral" = "lit",
) {
  p.intentions.push(intention);
  p.checkIns.push({
    intention_id: intention.id,
    outcome: "yes",
    reflection: "",
    energy,
    created_at: `${intention.day}T21:00:00Z`,
  });
}

test("weekly recommendations include a custom interest and exclude old, future and uncompleted experiences", () => {
  const p = emptyPractice();
  lived(
    p,
    moment("old", "2026-09-01", {
      interest: "Ceramics",
      action: "Make a bowl",
    }),
  );
  lived(
    p,
    moment("custom", "2026-10-25", {
      interest: "Repairing old radios",
      action: "Fix the tuning knob",
      planet: "Grow",
    }),
  );
  lived(p, moment("future", "2026-10-27", { interest: "Music" }));
  p.intentions.push(moment("not-yet", "2026-10-26", { interest: "Cooking" }));
  p.checkIns.push({
    intention_id: "not-yet",
    outcome: "not_yet",
    energy: "lit",
    reflection: "",
    created_at: "2026-10-26T21:00:00Z",
  });
  const suggestion = weeklyPossibility(p, "2026-10-26");
  assert.equal(suggestion?.title, "Repairing old radios");
  assert.equal(suggestion?.first, "Fix the tuning knob");
  assert.deepEqual(suggestion?.sourceIds, ["custom"]);
  assert.equal(suggestion?.planet, "Grow");
  p.entries.push(
    entry("interest", "Repairing old radios", { state: "paused" }),
  );
  assert.equal(weeklyPossibility(p, "2026-10-26"), null);
});

test("an adjacent catalogue suggestion cites only its positive moments this week", () => {
  const p = emptyPractice();
  lived(
    p,
    moment("a", "2026-10-21", { interest: "Ceramics", action: "Shape a bowl" }),
  );
  lived(
    p,
    moment("b", "2026-10-25", {
      interest: "Ceramics",
      action: "Glaze the bowl",
    }),
  );
  const suggestion = weeklyPossibility(p, "2026-10-26", [
    {
      id: "ceramics",
      title: "Ceramics",
      description: "Make with clay",
      first: "Shape a bowl",
      time: "30 min",
      cost: "Clay needed",
      related: ["drawing"],
    },
    {
      id: "drawing",
      title: "Drawing",
      description: "Look closely",
      first: "Sketch a cup",
      time: "10 min",
      cost: "Paper and pencil",
      related: ["ceramics"],
    },
  ]);
  assert.ok(suggestion);
  assert.equal(suggestion.title, "Drawing");
  assert.deepEqual(new Set(suggestion.sourceIds), new Set(["a", "b"]));
  assert.match(suggestion.reason, /different moments this week/);
  assert.ok(suggestion.first);
});

test("why guidance follows selected evidence, never a guess from the wording alone", () => {
  const p = emptyPractice();
  p.entries = [
    entry("why", "My why", {
      state: "accepted",
      body: "I want to teach and help people",
      source_ids: [],
    }),
    entry("interest", "Teaching", { meta: { planet: "Passions" } }),
  ];
  assert.deepEqual(whyThreads(p), []);
  assert.equal(morningCue(p, "2026-10-26", "Passions"), null);
  p.entries[0].source_ids = ["A story"];
  p.entries[1].source_ids = ["A story"];
  assert.equal(whyThreads(p)[0].title, "Teaching");
  assert.match(morningCue(p, "2026-10-26", "Passions")!.line, /clue you chose/);
  const intention = moment("today", "2026-10-26", {
    interest: "Teaching",
    action: "Explain a recipe",
  });
  assert.equal(intentionConnectsToWhy(p, intention), true);
  p.entries[0].source_ids = [];
  p.entries.push(
    entry("story", "My why in action", {
      body: "I will explain a recipe",
      source_ids: ["My why"],
      meta: { period: "why-action:2026-10-26" },
    }),
  );
  assert.equal(intentionConnectsToWhy(p, intention), true);
});

test("morning carry-forward requires actual positive experience in the chosen area and respects a stopped question", () => {
  const p = emptyPractice();
  lived(
    p,
    moment("yesterday", "2026-10-25", {
      interest: "Music",
      planet: "Passions",
    }),
  );
  const cue = morningCue(p, "2026-10-26", "Passions");
  assert.ok(cue);
  assert.equal(morningCue(p, "2026-10-26", "People"), null);
  p.entries.push(entry("question", cue.question, { state: "stopped" }));
  assert.equal(morningCue(p, "2026-10-26", "Passions"), null);
  p.entries = [];
  p.checkIns[0].outcome = "not_yet";
  assert.equal(morningCue(p, "2026-10-26", "Passions"), null);
});

test("a night insight needs different lived moments and waits before offering another", () => {
  const p = emptyPractice();
  const today = moment("today", "2026-10-26", {
    interest: "Music",
    action: "Play with my sister",
  });
  assert.equal(
    nightInsight(p, today, { outcome: "yes", energy: "lit" }, "2026-10-26"),
    null,
  );
  lived(
    p,
    moment("before", "2026-10-20", {
      interest: "Music",
      action: "Sing at home",
    }),
  );
  const insight = nightInsight(
    p,
    today,
    { outcome: "yes", energy: "lit" },
    "2026-10-26",
  );
  assert.match(insight!.text, /Sing at home/);
  assert.deepEqual(insight!.sourceIds, ["before", "today"]);
  assert.equal(
    nightInsight(p, today, { outcome: "not_yet", energy: "lit" }, "2026-10-26"),
    null,
  );
  p.entries.push(
    entry("preferences", "Check-in session", {
      meta: { last_insight_at: "2026-10-24T21:00:00Z" },
    }),
  );
  assert.equal(
    nightInsight(p, today, { outcome: "yes", energy: "lit" }, "2026-10-26"),
    null,
  );
});

test("future sorting proposes only existing words and leaves uncertain areas empty", () => {
  const text =
    "More time outdoors and closer relationships with my sisters. Learn French.";
  const map = proposeAreaMap(text);
  assert.equal(map.Passions, "More time outdoors");
  assert.equal(map.People, "closer relationships with my sisters");
  assert.equal(map.Grow, "Learn French");
  assert.equal(map.Causes, undefined);
  assert.deepEqual(proposeAreaMap("A life that feels like mine"), {});
});

test("a why revisit uses calendar months and features different kinds of real evidence", () => {
  assert.equal(quarterStart("2026-05-31"), "2026-02-28");
  const p = emptyPractice();
  p.profile.timezone = "UTC";
  p.entries = [
    entry("story", "old", {
      body: "Old thought",
      updated_at: "2026-06-01T12:00:00Z",
    }),
    entry("story", "recent", {
      body: "A useful thought",
      updated_at: "2026-10-25T12:00:00Z",
    }),
  ];
  lived(p, moment("lit", "2026-10-24", { interest: "Drawing" }));
  lived(p, moment("people", "2026-10-25", { person: "my aunt" }), "neutral");
  lived(p, moment("unrelated", "2026-06-24", { interest: "Music" }));
  const evidence = whyEvidence(p, "2026-10-26", true);
  assert.deepEqual(
    new Set(evidence.map((e) => e.id)),
    new Set(["lit", "people", "recent"]),
  );
  assert.deepEqual(
    new Set(featuredWhyEvidence(evidence).map((e) => e.kind)),
    new Set(["energy", "people", "story"]),
  );
});
