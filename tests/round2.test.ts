import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import {
  MISSIONS,
  INTEREST_LINKS,
  LEARNING_SHELF,
  pickMission,
  whereOptions,
  similarInterests,
  somedayMission,
  isHardDay,
  rareMomentAllowed,
  seasonalSunday,
  livedFocuses,
  selectMission,
} from "../src/round2";
const entry = (
  title: string,
  state: string,
  kind: "interest" | "value" = "interest",
): Entry => ({
  ...entryInput(kind, title, { state }),
  id: title,
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
});
test("current workbook is imported completely with stable IDs and required tags", () => {
  assert.equal(MISSIONS.length, 1152);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, 1152);
  assert.equal(MISSIONS.filter((m) => m.type === "learn").length, 180);
  assert.equal(MISSIONS.filter((m) => m.id.startsWith("SD-")).length, 15);
  assert.equal(LEARNING_SHELF.length, 56);
  assert.equal(INTEREST_LINKS.length, 44);
  assert.ok(
    MISSIONS.every(
      (m) => m.priorities.length && m.first_step && m.mission_text,
    ),
  );
});
test("second wheel includes every active stage in order; more interests exclude all existing picks", () => {
  const p = emptyPractice();
  p.entries = [
    entry("hiking", "into_it"),
    entry("reading", "all_in"),
    entry("gardening", "want_to_try"),
    entry("working out", "from_time_to_time"),
    entry("yoga", "on_pause"),
  ];
  assert.deepEqual(
    whereOptions(p, [{ id: "home", label: "at home", sort_order: 0 }]).map(
      (x) => x.label,
    ),
    ["anywhere", "at home", "reading", "hiking", "working out", "gardening"],
  );
  const more = similarInterests(p);
  assert.equal(more.length, 3);
  assert.ok(
    more.every((l) => !p.entries.some((e) => e.title === l.similar_interest)),
  );
});
test("mission matching keeps priority when a who/where combination is unavailable", () => {
  const p = emptyPractice();
  const selected = pickMission(p, "patient", "with my kids", "place")!;
  assert.ok(selected.priorities.includes("patient"));
  assert.ok(selected.places.includes("with my kids"));
  assert.equal(selected.level, "easy");
  const interest = selectMission(p, {
    priority: "patient",
    where: "hiking",
    kind: "interest",
    now: new Date("2026-11-16T09:00:00Z"),
  });
  assert.ok(interest.mission?.priorities.includes("patient"));
  if (interest.whereCleared) assert.equal(interest.effectiveWhere, "anywhere");
  assert.equal(
    pickMission(p, "patient", "anywhere", "anywhere", "normal")?.level,
    "normal",
  );
  assert.equal(
    pickMission(p, "patient", "anywhere", "anywhere", "stretch", "learn")?.type,
    "learn",
  );
  const first = pickMission(p, "brave", "anywhere", "anywhere")!;
  p.intentions = [
    {
      id: "one",
      day: "2026-11-12",
      action: first.mission_text,
      value: "brave",
      person: "",
      created_at: "",
      mission_id: first.id,
      mission_step: first.ladder_step,
    },
  ];
  p.checkIns = [
    { intention_id: "one", outcome: "yes", reflection: "", created_at: "" },
  ];
  assert.ok(
    pickMission(p, "brave", "anywhere", "anywhere")!.ladder_step >=
      first.ladder_step,
  );
});
test("all five someday starter families substitute the actual goal and preserve IDs", () => {
  for (const [text, code] of [
    ["Visit Japan", "SEE"],
    ["Buy a house", "HAV"],
    ["Learn guitar", "LRN"],
    ["Give back to my town", "GIV"],
    ["Become a mentor", "BEC"],
  ]) {
    const m = somedayMission(
      emptyPractice(),
      { id: "s", text, horizon: "five_years", status: "open" },
      "easy",
    )!;
    assert.ok(m.id.startsWith(`SD-${code}`));
    assert.ok(m.mission_text.includes(text));
    assert.ok(!m.mission_text.includes("[your someday]"));
  }
});
test("rare moments cannot stack, repeat in a week or appear on a hard day", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  assert.ok(isHardDay("It was a rough day"));
  assert.equal(rareMomentAllowed([], "narrowing", "s", true, now), false);
  assert.equal(
    rareMomentAllowed(
      [{ type: "worst_case", session_id: "s", asked_at: now.toISOString() }],
      "cost_of_waiting",
      "s",
      false,
      now,
    ),
    false,
  );
  assert.equal(
    rareMomentAllowed(
      [
        {
          type: "learning",
          session_id: "old",
          asked_at: "2026-11-12T12:00:00Z",
        },
      ],
      "learning",
      "s",
      false,
      now,
    ),
    false,
  );
});
test("seasonal Sunday uses actual completed steps and never empty days", () => {
  assert.ok(seasonalSunday("2026-12-06"));
  assert.equal(seasonalSunday("2026-12-13"), false);
  const p = emptyPractice();
  p.intentions = [
    {
      id: "a",
      day: "2026-11-03",
      action: "Helped",
      value: "kind",
      person: "Sam",
      created_at: "",
    },
    {
      id: "b",
      day: "2026-12-05",
      action: "Unfinished",
      value: "brave",
      person: "",
      created_at: "",
    },
  ];
  p.checkIns = [
    { intention_id: "a", outcome: "yes", reflection: "", created_at: "" },
    { intention_id: "b", outcome: "not_yet", reflection: "", created_at: "" },
  ];
  assert.deepEqual(
    livedFocuses(p, "2026-12-06").map((i) => i.id),
    ["a"],
  );
});
