import assert from "node:assert/strict";
import test from "node:test";
import { emptyPractice, shiftDay } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import { MISSIONS, LEARNING_SHELF, type Round2Mission } from "../src/round2";
import {
  missionFamilyId,
  missionUnavailableReason,
  selectMission,
} from "../src/mission-selection";
import {
  missionFeedbackEntry,
  missionSignals,
  missionRecommendationPool,
} from "../src/mission-feedback";
import { todayIdeas } from "../src/round4-flow";
import { missionFitsSavedContext } from "../supabase/functions/chloe/mission-fit";
import { personalMissions } from "../supabase/functions/chloe/library";
import {
  missionAffinity,
  recentMissionFamilies,
  recommendationProfile,
  recommendationRank,
  type MissionSignal,
} from "../supabase/functions/_shared/mission-recommendations";
import oldMissions from "../data/round4/missions.json";
import source from "../data/round5/source.json";

const day = "2026-11-27";
const now = new Date(`${day}T10:00:00Z`);
const practice = () => {
  const p = emptyPractice();
  p.profile.timezone = "UTC";
  return p;
};
const complete = (
  entry: ReturnType<typeof entryInput>,
  id = "preference",
): Entry => ({
  ...entry,
  id: entry.id || id,
  created_at: `${day}T08:00:00Z`,
  updated_at: `${day}T08:00:00Z`,
});
const fake = (
  id: string,
  ladder: string,
  step = 1,
  interest = "reading",
): Round2Mission => ({
  ...MISSIONS[0],
  id,
  family_id: missionFamilyId(id),
  ladder,
  ladder_step: step,
  priorities: ["kind"],
  interests: [interest],
  places: ["at home"],
  ages: [],
  mission_text: "Read a short passage together.",
  first_step: "Open your book.",
  type: "do",
  setting: "Home",
  level: "easy",
  size: "5-minute",
  minutes: 5,
});

test("v2 catalogue keeps historical text and IDs, with only the 24 approved joyful retags", () => {
  assert.equal(MISSIONS.length, 1284);
  assert.equal(LEARNING_SHELF.length, 59);
  const current = new Map(MISSIONS.map((mission) => [mission.id, mission]));
  let changed = 0;
  for (const old of oldMissions) {
    const mission = current.get(old.id)!;
    assert.ok(mission, old.id);
    assert.deepEqual({ ...mission, priorities: old.priorities }, old);
    if (mission.priorities.length !== old.priorities.length) {
      changed++;
      assert.deepEqual(mission.priorities, [...old.priorities, "joyful"]);
    }
  }
  assert.equal(changed, 24);
  assert.equal(
    MISSIONS.filter((mission) => mission.ages?.includes("adults")).length,
    9,
  );
  assert.equal(
    MISSIONS.filter((mission) => mission.id.startsWith("BE-JOY-")).length,
    15,
  );
  assert.equal(
    MISSIONS.filter((mission) => mission.id.startsWith("LR-P39-")).length,
    3,
  );
  assert.equal(source.removed_missions, 0);
});

test("adults-only excludes blank-age kid tasks on client and server, but mixed ages retain them", () => {
  const p = practice();
  const blank = MISSIONS.find((mission) => mission.id === "PE-KID-1a")!;
  const adult = MISSIONS.find((mission) => mission.id === "KA-01a")!;
  p.entries = [
    complete(
      entryInput("preferences", "Kids ages", {
        meta: { ages: ["adults"], asked: true },
      }),
    ),
  ];
  assert.match(missionUnavailableReason(blank, p, now) || "", /grown kids/);
  assert.equal(missionUnavailableReason(adult, p, now), undefined);
  const moment = {
    day,
    hour: 10,
    weekend: false,
    ages: ["adults"],
    priority: "",
    kind: "place",
    where: "with my kids",
  };
  assert.equal(
    missionFitsSavedContext({ ...blank, size: "5-minute" }, moment),
    false,
  );
  assert.equal(
    missionFitsSavedContext({ ...adult, size: "5-minute" }, moment),
    true,
  );
  p.entries[0].meta.ages = ["adults", "under 6"];
  assert.equal(missionUnavailableReason(blank, p, now), undefined);
  assert.equal(missionUnavailableReason(adult, p, now), undefined);
  assert.equal(
    missionFitsSavedContext(
      { ...blank, size: "5-minute" },
      { ...moment, ages: ["adults", "under 6"] },
    ),
    true,
  );
  p.entries[0].meta.ages = [];
  assert.match(missionUnavailableReason(adult, p, now) || "", /ages/);
});

test("a seen, picked or passed idea stays out for 28 local days, including its other sizes", () => {
  const first = fake("one-1a", "First");
  const second = fake("two-1a", "Second");
  const p = practice();
  const options = {
    priority: "kind",
    where: "anywhere",
    kind: "anywhere",
    now,
    pool: [first, second],
  };
  for (const action of ["shown", "picked", "passed"] as const) {
    p.entries = [
      complete(
        missionFeedbackEntry(
          first,
          action,
          shiftDay(day, -27),
          "today",
          "account",
        ),
      ),
    ];
    assert.equal(selectMission(p, options).mission?.id, second.id);
    assert.equal(
      selectMission(p, { ...options, familyId: first.family_id }).mission?.id,
      first.id,
      "a person can explicitly keep a chosen family while changing its size",
    );
    p.entries[0].meta.feedback_day = shiftDay(day, -28);
    assert.equal(
      recentMissionFamilies(missionSignals(p), day, options.pool).size,
      0,
    );
  }
  p.entries = [
    complete(missionFeedbackEntry(first, "shown", day, "today", "account")),
  ];
  assert.equal(
    selectMission(p, options).mission?.id,
    second.id,
    "a new batch on the same day does not silently repeat an earlier card",
  );
});

test("feedback IDs deduplicate retries without crossing owners or local days", () => {
  const mission = MISSIONS[0];
  const one = missionFeedbackEntry(mission, "shown", day, "today", "owner-one");
  assert.equal(
    one.id,
    missionFeedbackEntry(mission, "shown", day, "today", "owner-one").id,
  );
  assert.notEqual(
    one.id,
    missionFeedbackEntry(mission, "shown", day, "today", "owner-two").id,
  );
  assert.notEqual(
    one.id,
    missionFeedbackEntry(
      mission,
      "shown",
      shiftDay(day, 1),
      "today",
      "owner-one",
    ).id,
  );
  assert.match(
    one.id!,
    /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/,
  );
  assert.equal(one.body, "");
  const p = practice();
  p.entries = [
    complete(one),
    complete(one),
    complete(
      missionFeedbackEntry(mission, "shown", day, "build_action", "owner-one"),
    ),
  ];
  assert.equal(missionSignals(p).length, 1);
});

test("energy independently shapes future ladder and interest suggestions, without treating missing answers as neutral", () => {
  const old = fake("past-1a", "Reading ladder");
  const next = fake("next-2a", "Reading ladder", 2);
  const related = fake("related-1a", "Other reading ladder");
  const p = practice();
  p.intentions = [
    {
      id: "focus",
      day: shiftDay(day, -3),
      action: "Read",
      value: "kind",
      person: "",
      mission_id: old.id,
      created_at: "",
    },
  ];
  p.checkIns = [
    {
      intention_id: "focus",
      outcome: "not_yet",
      reflection: "",
      energy: "lit",
      created_at: "",
    },
  ];
  const lit = recommendationProfile(
    missionSignals(p),
    [old, next, related],
    day,
  );
  assert.ok(missionAffinity(next, lit) > 0);
  assert.ok(missionAffinity(related, lit) > 0);
  p.checkIns[0].energy = "drained";
  p.checkIns[0].outcome = "yes";
  const drained = recommendationProfile(
    missionSignals(p),
    [old, next, related],
    day,
  );
  assert.ok(missionAffinity(next, drained) < 0);
  assert.ok(missionAffinity(related, drained) < 0);
  p.checkIns[0].energy = null;
  assert.ok(
    !missionSignals(p).some((signal) =>
      ["neutral", "lit", "drained"].includes(signal.action),
    ),
  );
});

test("weighted rotation offers energy-giving ladders more often and drained or repeatedly passed ladders less", () => {
  const old = fake("past-1a", "Liked ladder");
  const next = fake("next-2a", "Liked ladder", 2);
  const alternative = fake("other-2a", "Other ladder", 2, "gardening");
  const count = (action: "lit" | "neutral" | "drained" | "passed") => {
    const signals: MissionSignal[] = [1, 2, 3].map((offset) => ({
      missionId: old.id,
      action,
      day: shiftDay(day, -offset),
    }));
    const profile = recommendationProfile(
      signals,
      [old, next, alternative],
      day,
    );
    let picked = 0;
    for (let index = 0; index < 180; index++) {
      const sampleDay = shiftDay(day, index);
      if (
        recommendationRank(
          next.family_id!,
          sampleDay,
          missionAffinity(next, profile),
        ) <
        recommendationRank(
          alternative.family_id!,
          sampleDay,
          missionAffinity(alternative, profile),
        )
      )
        picked++;
    }
    return picked;
  };
  assert.ok(count("lit") > count("neutral"));
  assert.ok(count("drained") < count("neutral"));
  assert.ok(count("passed") < count("neutral"));
});

test("ratings of private custom missions still shape the person's interest preferences", () => {
  const p = practice();
  p.intentions = [
    {
      id: "custom",
      day: shiftDay(day, -2),
      action: "Try ukulele",
      value: "creative",
      interest: "playing ukulele",
      person: "",
      mission_id: "personal-owner-old-5-minute",
      mission_step: 1,
      created_at: "",
    },
  ];
  p.checkIns = [
    {
      intention_id: "custom",
      outcome: "yes",
      reflection: "",
      energy: "drained",
      created_at: "",
    },
  ];
  const pool = missionRecommendationPool(p, MISSIONS);
  const profile = recommendationProfile(missionSignals(p), pool, day);
  assert.ok((profile.interest.get("playing ukulele") || 0) < 0);
  const custom = fake(
    "personal-owner-new-5-minute",
    "playing ukulele",
    1,
    "playing ukulele",
  );
  p.entries = [
    complete(
      missionFeedbackEntry(
        custom,
        "passed",
        shiftDay(day, -1),
        "today",
        "owner",
      ),
    ),
  ];
  assert.ok(
    (recommendationProfile(
      missionSignals(p),
      missionRecommendationPool(p, MISSIONS),
      day,
    ).interest.get("playing ukulele") || 0) <
      profile.interest.get("playing ukulele")!,
  );
});

test("the mission endpoint enforces recent impressions even when an older client sends no exclusions", async () => {
  const currentDay = new Date().toISOString().slice(0, 10);
  const rows = ["seen", "fresh"].flatMap((family) =>
    (["5-minute", "Normal", "Stretch"] as const).map((size, index) => ({
      ...fake(`${family}-1${"abc"[index]}`, `${family} ladder`),
      family_id: `${family}-1`,
      tags: ["reading"],
      size,
      minutes: [5, 25, 45][index],
    })),
  );
  const scoped = {
    rpc: async () => ({ data: rows, error: null }),
    from(table: string) {
      const filters = new Map<string, unknown>();
      const result = () => {
        if (table === "profiles")
          return { data: { timezone: "UTC" }, error: null };
        if (table === "journey_entries" && filters.get("kind") === "event")
          return {
            data: [
              {
                entry: {
                  created_at: `${currentDay}T00:00:00Z`,
                  meta: {
                    mission_id: "seen-1a",
                    outcome: "shown",
                    feedback_day: currentDay,
                  },
                },
              },
            ],
            error: null,
          };
        return { data: [], error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.set(key, value);
          return query;
        },
        in: () => query,
        gte: () => query,
        order: () => query,
        limit: () => query,
        single: async () => result(),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error(
      "A fresh catalogue family should be used without generation.",
    );
  };
  try {
    const result = await personalMissions(
      scoped as never,
      scoped as never,
      "owner",
      { interest: "reading", ladder_step: 1 },
      "",
      "test-model",
    );
    assert.equal(result.missions.length, 3);
    assert.ok(
      result.missions.every((mission) => mission.family_id === "fresh-1"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a completed energizing step favours the next step without repeating the previous family", () => {
  const old = fake("past-1a", "Growing");
  const next = fake("next-2a", "Growing", 2);
  const later = fake("later-3a", "Growing", 3);
  const signals: MissionSignal[] = ["done", "lit"].map((action) => ({
    missionId: old.id,
    action: action as "done" | "lit",
    day: shiftDay(day, -1),
  }));
  const profile = recommendationProfile(signals, [old, next, later], day);
  assert.ok(missionAffinity(next, profile) > missionAffinity(later, profile));
  assert.ok(
    recentMissionFamilies(signals, day, [old, next]).has(old.family_id!),
  );
  assert.ok(
    !recentMissionFamilies(signals, day, [old, next]).has(next.family_id!),
  );
});

test("Today rotates its leading priority over days and saved reminders can intentionally repeat", () => {
  const p = practice();
  p.entries = [
    "kind",
    "curious",
    "creative",
    "patient",
    "grateful",
    "joyful",
    "calm",
  ].map((title, index) =>
    complete(
      entryInput("value", title, { state: "working_on" }),
      `value-${index}`,
    ),
  );
  const labels = Array.from({ length: 7 }, (_, offset) => {
    const current = shiftDay(day, offset);
    return todayIdeas(p, [], current, new Date(`${current}T10:00:00Z`))[0]
      ?.label;
  });
  assert.ok(new Set(labels).size >= 3);
  const mission = MISSIONS.find((item) => item.id === "BE-JOY-1a")!;
  p.entries.push(
    complete(
      missionFeedbackEntry(
        mission,
        "shown",
        shiftDay(day, -1),
        "today",
        "owner",
      ),
    ),
  );
  p.entries.push(
    complete(
      entryInput("preferences", "Action reminder", {
        body: mission.mission_text,
        meta: { mission_id: mission.id, reminder_day: day, status: "open" },
      }),
      "reminder",
    ),
  );
  assert.equal(todayIdeas(p, [], day, now)[0]?.pending.missionId, mission.id);
});
