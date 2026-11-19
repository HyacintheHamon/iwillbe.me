import test from "node:test";
import assert from "node:assert/strict";
import oldCatalogue from "../data/round2/missions.json";
import { emptyPractice } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import {
  MISSIONS,
  selectMission,
  missionFamilyId,
  somedaySelection,
  similarInterests,
  type Level,
  type Round2Mission,
} from "../src/round2";
import {
  missionLocalMoment,
  missionUnavailableReason,
  themeWeights,
} from "../src/mission-selection";

const morning = new Date("2026-11-16T14:00:00Z");
const evening = new Date("2026-11-16T23:00:00Z");
const profile = () => {
  const p = emptyPractice();
  p.profile.timezone = "America/New_York";
  return p;
};
const preference = (title: string, meta: Entry["meta"]): Entry => ({
  ...entryInput("preferences", title, { meta }),
  id: title,
  created_at: "2026-11-16T10:00:00Z",
  updated_at: "2026-11-16T10:00:00Z",
});
const mission = (
  id: string,
  overrides: Partial<Round2Mission> = {},
): Round2Mission => ({
  ...MISSIONS[0],
  id,
  family_id: missionFamilyId(id),
  ages: [],
  theme: "",
  setting: "Home",
  mission_text: "Write a kind note together.",
  priorities: ["kind"],
  places: ["with my kids"],
  level: "easy",
  minutes: 5,
  ...overrides,
});

test("Round 3 retains every historical ID and imports all new age and theme data", () => {
  for (const old of oldCatalogue) {
    const current = MISSIONS.find((m) => m.id === old.id);
    assert.ok(current, old.id);
    assert.equal(current.mission_text, old.mission_text);
    assert.equal(current.first_step, old.first_step);
  }
  assert.equal(MISSIONS.filter((m) => m.id.startsWith("HL-")).length, 27);
  assert.equal(MISSIONS.filter((m) => m.id.startsWith("KK-")).length, 36);
  assert.deepEqual(MISSIONS.find((m) => m.id === "CA-MEN-3b")?.ages, ["teens"]);
  assert.equal(missionFamilyId("KK-05a"), missionFamilyId("KK-05c"));
  assert.notEqual(missionFamilyId("GR-FIT-1a2"), missionFamilyId("GR-FIT-1b"));
});

test("who/where is strict, priority leads, and fallback clears who/where", () => {
  const p = profile();
  const pool = [
    mission("secondary-1a", { priorities: ["close to nature", "kind"] }),
    mission("primary-1a"),
    mission("where-only-1a", { priorities: ["ambitious"] }),
  ];
  const exact = selectMission(p, {
    priority: "kind",
    where: "with my kids",
    kind: "place",
    now: morning,
    pool,
  });
  assert.equal(exact.mission?.id, "primary-1a");
  assert.equal(exact.whereCleared, false);
  const fallback = selectMission(p, {
    priority: "kind",
    where: "on the road",
    kind: "place",
    now: morning,
    pool,
  });
  assert.equal(fallback.mission?.id, "primary-1a");
  assert.equal(fallback.effectiveWhere, "anywhere");
  assert.equal(fallback.effectiveKind, "anywhere");
  assert.equal(fallback.whereCleared, true);
  assert.equal(
    selectMission(p, {
      priority: "patient",
      where: "with my kids",
      kind: "place",
      now: morning,
      pool,
    }).mission,
    undefined,
  );
});

test("an exact secondary priority match wins over a main priority in the wrong place", () => {
  const result = selectMission(profile(), {
    priority: "kind",
    where: "with my kids",
    kind: "place",
    now: morning,
    pool: [
      mission("secondary-1a", { priorities: ["patient", "kind"] }),
      mission("other-1a", { places: ["with my team"] }),
    ],
  });
  assert.equal(result.mission?.id, "secondary-1a");
  assert.equal(result.whereCleared, false);
});

test("kind with young kids on a weekday evening keeps one at-home idea across all three sizes", () => {
  const p = profile();
  p.entries = [preference("Kids ages", { ages: ["under 6"], asked: true })];
  const options = {
    priority: "kind",
    where: "with my kids",
    kind: "place",
    now: evening,
  };
  const first = selectMission(p, options);
  assert.ok(first.mission?.id.startsWith("KK-"));
  assert.deepEqual(first.availableLevels, ["easy", "normal", "stretch"]);
  for (const level of ["easy", "normal", "stretch"] as Level[]) {
    const selected = selectMission(p, {
      ...options,
      level,
      familyId: first.familyId,
    });
    assert.ok(selected.mission);
    assert.equal(selected.familyId, first.familyId);
    assert.ok(selected.mission.places.includes("with my kids"));
    assert.equal(selected.mission.priorities[0], "kind");
    assert.ok(selected.mission.ages?.includes("under 6"));
    assert.equal(
      missionUnavailableReason(selected.mission, p, evening),
      undefined,
    );
    if (level === "normal") assert.ok(selected.mission.minutes <= 30);
    // Re-evaluating without a lock also never changes the family merely for a size.
    assert.equal(
      selectMission(p, { ...options, level }).familyId,
      first.familyId,
    );
  }
});

test("an unavailable size never switches the chosen family to another idea", () => {
  const p = profile();
  p.entries = [preference("Kids ages", { ages: ["6–12"], asked: true })];
  const selected = selectMission(p, {
    priority: "kind",
    where: "with my kids",
    kind: "place",
    level: "stretch",
    familyId: "KK-07",
    now: evening,
  });
  assert.equal(selected.familyId, "KK-07");
  assert.equal(selected.mission, undefined);
  assert.deepEqual(selected.availableLevels, ["easy", "normal"]);
  assert.match(selected.unavailableReasons.stretch || "", /morning/);
});

test("age filters honor multiple groups and do not assume teens when ages are skipped", () => {
  const p = profile();
  const teen = MISSIONS.find((m) => m.id === "CA-MEN-3b")!;
  assert.match(missionUnavailableReason(teen, p, morning) || "", /ages/);
  p.entries = [
    preference("Kids ages", { ages: ["under 6", "6–12"], asked: true }),
  ];
  assert.match(
    missionUnavailableReason(teen, p, morning) || "",
    /different age/,
  );
  assert.equal(
    missionUnavailableReason(
      MISSIONS.find((m) => m.id === "KK-05b")!,
      p,
      evening,
    ),
    undefined,
  );
});

test("time filters use the profile timezone, weekdays and local evening boundary", () => {
  const p = profile();
  const outing = mission("outing-1a", { setting: "Out and about" });
  assert.equal(missionUnavailableReason(outing, p, morning), undefined);
  assert.match(
    missionUnavailableReason(outing, p, new Date("2026-11-16T17:00:00Z")) || "",
    /morning/,
  );
  assert.equal(
    missionLocalMoment(p, new Date("2026-11-16T22:00:00Z")).hour,
    17,
  );
  const long = mission("long-1b", { level: "normal", minutes: 60 });
  assert.match(missionUnavailableReason(long, p, morning) || "", /weekend/);
  assert.equal(
    missionUnavailableReason(long, p, new Date("2026-11-21T14:00:00Z")),
    undefined,
  );
  const stretch = mission("long-1c", { level: "stretch", minutes: 120 });
  assert.match(missionUnavailableReason(stretch, p, morning) || "", /weekend/);
  assert.equal(
    missionUnavailableReason(stretch, p, new Date("2026-11-21T14:00:00Z")),
    undefined,
  );
});

test("healthy rotates themes by local day and a saved preference weights its first rotation", () => {
  const p = profile();
  const themes = Array.from({ length: 14 }, (_, index) => {
    const now = new Date(morning.getTime() + index * 86400000);
    return selectMission(p, {
      priority: "healthy",
      where: "anywhere",
      kind: "anywhere",
      now,
    }).theme;
  });
  assert.ok(new Set(themes).size >= 6);
  for (let i = 1; i < themes.length; i++)
    assert.notEqual(themes[i], themes[i - 1]);
  p.entries = [
    preference("Priority theme", {
      priority: "healthy",
      theme: "sleep",
      asked: true,
    }),
  ];
  assert.equal(
    selectMission(p, {
      priority: "healthy",
      where: "anywhere",
      kind: "anywhere",
      now: morning,
    }).theme,
    "sleep",
  );
});

test("passing sleep suggestions reduces their frequency; completion and energy increase preference", () => {
  const baseline = profile();
  const passed = profile();
  passed.entries = Array.from({ length: 3 }, (_, index) => ({
    ...entryInput("event", "Mission feedback", {
      meta: {
        mission_id: "HL-SLP-1a",
        priority: "healthy",
        theme: "sleep",
        outcome: "passed",
      },
    }),
    id: `pass-${index}`,
    created_at: "2026-11-15T10:00:00Z",
    updated_at: "2026-11-15T10:00:00Z",
  }));
  const countSleep = (p: ReturnType<typeof profile>) =>
    Array.from(
      { length: 90 },
      (_, index) =>
        selectMission(p, {
          priority: "healthy",
          where: "anywhere",
          kind: "anywhere",
          now: new Date(morning.getTime() + index * 86400000),
        }).theme,
    ).filter((theme) => theme === "sleep").length;
  assert.ok(countSleep(passed) < countSleep(baseline));
  const liked = profile();
  liked.intentions = [
    {
      id: "focus",
      day: "2026-11-15",
      action: "Sleep",
      value: "healthy",
      person: "",
      mission_id: "HL-SLP-1a",
      created_at: "",
    },
  ];
  liked.checkIns = [
    {
      intention_id: "focus",
      outcome: "yes",
      reflection: "",
      energy: "lit",
      created_at: "",
    },
  ];
  assert.ok(
    themeWeights(liked, "healthy", ["sleep", "water"]).weights.sleep >
      themeWeights(baseline, "healthy", ["sleep", "water"]).weights.sleep,
  );
});

test("Another idea changes the whole family for kind while preserving the selected kids context", () => {
  const p = profile();
  p.entries = [preference("Kids ages", { ages: ["under 6"], asked: true })];
  const options = {
    priority: "kind",
    where: "with my kids",
    kind: "place",
    now: evening,
  };
  const first = selectMission(p, options);
  assert.ok(first.mission);
  p.entries.push({
    ...entryInput("event", "Mission feedback", {
      state: "passed",
      source_ids: [first.mission.id],
      meta: {
        mission_id: first.mission.id,
        priority: "kind",
        outcome: "passed",
      },
    }),
    id: "passed-kind",
    created_at: evening.toISOString(),
    updated_at: evening.toISOString(),
  });
  const next = selectMission(p, options);
  assert.ok(next.mission);
  assert.notEqual(next.familyId, first.familyId);
  assert.equal(next.whereCleared, false);
  assert.ok(next.mission.priorities.includes("kind"));
  assert.ok(next.mission.places.includes("with my kids"));
  assert.equal(missionUnavailableReason(next.mission, p, evening), undefined);
  const normal = selectMission(p, {
    ...options,
    level: "normal",
    familyId: next.familyId,
  });
  assert.equal(normal.familyId, next.familyId);
});

test("an interest can be selected without inventing a priority and more interests use its own links", () => {
  const p = profile();
  const selected = selectMission(p, {
    priority: "",
    where: "hiking",
    kind: "interest",
    now: morning,
  });
  assert.ok(selected.mission?.interests.includes("hiking"));
  assert.equal(selected.whereCleared, false);
  const more = similarInterests(p, 3, "hiking");
  assert.ok(
    more.length > 0 && more.every((link) => link.interest === "hiking"),
  );
});

test("someday keeps its family while substituting the actual item into every available size", () => {
  const p = profile();
  const item = {
    id: "japan",
    text: "Visit Japan",
    horizon: "this_year" as const,
    status: "open" as const,
  };
  const first = somedaySelection(p, item, "easy", { now: morning });
  assert.equal(first.familyId, "SD-SEE-1");
  for (const level of first.availableLevels) {
    const selected = somedaySelection(p, item, level, {
      now: morning,
      familyId: first.familyId,
    });
    assert.equal(selected.familyId, first.familyId);
    assert.ok(selected.mission?.mission_text.includes("Visit Japan"));
    assert.ok(!selected.mission?.mission_text.includes("[your someday]"));
  }
});
