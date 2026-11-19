import assert from "node:assert/strict";
import test from "node:test";
import { emptyPractice } from "../src/domain";
import { entryInput, type Entry } from "../src/journey";
import {
  shouldAskKidsAges,
  shouldAskPriorityTheme,
} from "../src/round3-preference-rules";
import { nightCompletionMarker } from "../src/night-completion";
import {
  fallbackNightThought,
  validNightThought,
} from "../supabase/functions/chloe/night-fallback";
import {
  nightThought,
  personalMissions,
} from "../supabase/functions/chloe/library";
import {
  matchingFamily,
  missionFitsSavedContext,
  missionMoment,
  type PersonalMission,
} from "../supabase/functions/chloe/mission-fit";
import {
  MODES,
  PROMPT_VERSION,
  systemPrompt,
} from "../supabase/functions/chloe/prompt";

function preference(title: string, meta: Entry["meta"]): Entry {
  return {
    ...entryInput("preferences", title, { meta }),
    id: title,
    created_at: "2026-11-19T12:00:00Z",
    updated_at: "2026-11-19T12:00:00Z",
  };
}

test("kids ages are optional, multi-select, once-only and grounded in the user's own kids", () => {
  const p = emptyPractice();
  assert.equal(shouldAskKidsAges(p, "I will read with my daughter"), true);
  assert.equal(shouldAskKidsAges(p, "I will mentor children at school"), false);
  assert.equal(shouldAskKidsAges(p, "I don't have kids"), false);
  assert.equal(shouldAskKidsAges(p, "", true), true);
  p.entries.push(
    preference("Kids ages", { ages: ["under 6", "6–12"], asked: true }),
  );
  assert.equal(shouldAskKidsAges(p, "with my kids", true), false);
  p.entries = [preference("Kids ages", { ages: [], asked: true })];
  assert.equal(
    shouldAskKidsAges(p, "my kids"),
    false,
    "skipping must not cause another question tomorrow",
  );
});

test("healthy theme question is not repeated after a choice or a skip", () => {
  const p = emptyPractice();
  assert.equal(shouldAskPriorityTheme(p, "kind"), false);
  assert.equal(shouldAskPriorityTheme(p, "healthy"), true);
  p.entries = [
    preference("Priority theme", {
      priority: "healthy",
      theme: "sleep",
      asked: true,
    }),
  ];
  assert.equal(shouldAskPriorityTheme(p, "healthy"), false);
  p.entries[0].meta.theme = undefined;
  assert.equal(shouldAskPriorityTheme(p, "healthy"), false);
});

test("night completion markers retain the day's identity and include no reflection content", () => {
  const p = emptyPractice();
  const first = nightCompletionMarker(p, "2026-11-19");
  assert.equal(first.body, "");
  assert.deepEqual(first.meta, { commitment_day: "2026-11-19" });
  p.entries = [
    {
      ...first,
      id: "existing-night",
      revision: 4,
      created_at: "2026-11-19T22:00:00Z",
      updated_at: "2026-11-19T22:00:00Z",
    },
  ];
  const again = nightCompletionMarker(p, "2026-11-19");
  assert.equal(again.id, "existing-night");
  assert.equal(again.revision, 4);
  assert.equal(nightCompletionMarker(p, "2026-11-20").id, undefined);
});

test("fallback closes three consecutive nights and only support levels 2/3 suppress it", () => {
  const thoughts = ["2026-11-17", "2026-11-18", "2026-11-19"].map((day) =>
    fallbackNightThought(day),
  );
  assert.ok(thoughts.every(validNightThought));
  assert.equal(new Set(thoughts.map((thought) => thought?.text)).size, 3);
  assert.ok(fallbackNightThought("2026-11-19", [], 1));
  assert.equal(fallbackNightThought("2026-11-19", [], 2), null);
  assert.equal(fallbackNightThought("2026-11-19", [], 3), null);
  assert.equal(
    validNightThought({
      format: "quote",
      text: "An uncredited quote",
      credit: "",
    }),
    false,
  );
  assert.equal(validNightThought({ format: "reframe", text: "" }), false);
});

function nightDatabase() {
  const history: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      const filters = new Map<string, unknown>();
      let insert: Record<string, unknown> | undefined;
      let single = false;
      const run = () => {
        if (insert) {
          if (table === "night_thought_history") {
            history.push({ ...insert, shown_at: `${insert.day}T23:00:00Z` });
            return { data: { snapshot: insert.snapshot }, error: null };
          }
          return { data: null, error: null };
        }
        let rows: Record<string, unknown>[] = [];
        if (table === "profiles")
          rows = [{ timezone: "America/New_York", faith_tradition: null }];
        else if (table === "night_thought_history")
          rows = history.filter((row) =>
            [...filters].every(([key, value]) => row[key] === value),
          );
        else if (
          ![
            "night_thoughts",
            "journey_entries",
            "intentions",
            "support_state",
          ].includes(table)
        )
          throw new Error(`Unexpected table: ${table}`);
        return { data: single ? rows[0] || null : rows, error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.set(key, value);
          return query;
        },
        in: () => query,
        order: () => query,
        limit: () => query,
        single: () => {
          single = true;
          return Promise.resolve(run());
        },
        maybeSingle: () => {
          single = true;
          return Promise.resolve(run());
        },
        insert: (row: Record<string, unknown>) => {
          insert = row;
          return query;
        },
        upsert: (row: Record<string, unknown>) => {
          insert = row;
          return query;
        },
        then: (resolve: (value: ReturnType<typeof run>) => unknown) =>
          Promise.resolve(run()).then(resolve),
      };
      return query;
    },
  };
  return { client, history };
}

test("night backend saves a dated reframe with no API key or shortlist, on three nights", async () => {
  const db = nightDatabase();
  for (const day of ["2026-11-17", "2026-11-18", "2026-11-19"]) {
    const result = await nightThought(
      db.client as never,
      db.client as never,
      "owner",
      "",
      "test-model",
      "A hard day at work",
      new Date(`${day}T23:00:00Z`),
    );
    assert.ok(validNightThought(result.thought));
  }
  assert.deepEqual(
    db.history.map((row) => row.day),
    ["2026-11-17", "2026-11-18", "2026-11-19"],
  );
  assert.equal(
    new Set(db.history.map((row) => (row.snapshot as { text: string }).text))
      .size,
    3,
  );
});

test("night backend recovers from an AI outage and never masks a level-2/3 response", async () => {
  const fetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error("Provider unavailable");
    };
    const db = nightDatabase();
    const result = await nightThought(
      db.client as never,
      db.client as never,
      "owner",
      "test-key",
      "test-model",
      "I am tired after work",
      new Date("2026-11-19T23:00:00Z"),
    );
    assert.ok(validNightThought(result.thought));
    assert.equal(db.history.length, 1);
    for (const level of [2, 3]) {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  support_level: level,
                  thought_id: null,
                  reframe: "",
                  preface: "",
                }),
              },
            ],
          }),
          { status: 200 },
        );
      const held = nightDatabase();
      const response = await nightThought(
        held.client as never,
        held.client as never,
        "owner",
        "test-key",
        "test-model",
        "Something has been hard",
        new Date("2026-11-19T23:00:00Z"),
      );
      assert.equal(response.thought, null);
      assert.equal(held.history.length, 0);
      assert.equal(
        "support_level" in response ? response.support_level : 0,
        level,
      );
    }
  } finally {
    globalThis.fetch = fetch;
  }
});

const mission = (
  id: string,
  size: PersonalMission["size"],
  extra: Partial<PersonalMission> = {},
): PersonalMission => ({
  id,
  family_id: "one-idea",
  mission_text: "Make a thank-you card together",
  first_step: "Find paper",
  tags: ["kind", "kids"],
  quick_picks: [],
  priorities: ["kind"],
  interests: [],
  places: ["with my kids"],
  who_for: ["kids"],
  ladder_step: 1,
  stage: "Want to try",
  size,
  minutes: size === "5-minute" ? 5 : size === "Normal" ? 25 : 45,
  cost: "Free",
  setting: "Home",
  safety_note: "",
  ages: ["under 6"],
  ...extra,
});

test("generated mission boundary enforces saved ages, exact who/where and local evening constraints", () => {
  const moment = {
    ...missionMoment("America/New_York", new Date("2026-11-16T23:00:00Z")),
    ages: ["under 6"],
    priority: "kind",
    where: "with my kids",
    kind: "place",
  };
  assert.equal(moment.hour, 18);
  assert.equal(missionFitsSavedContext(mission("a", "Normal"), moment), true);
  assert.equal(
    missionFitsSavedContext(mission("a", "Normal", { places: [] }), moment),
    false,
  );
  assert.equal(
    missionFitsSavedContext(
      mission("a", "Normal", { ages: ["teens"] }),
      moment,
    ),
    false,
  );
  assert.equal(
    missionFitsSavedContext(
      mission("a", "Normal", { setting: "Out and about" }),
      moment,
    ),
    false,
  );
  assert.equal(
    missionFitsSavedContext(mission("a", "Normal", { minutes: 45 }), moment),
    false,
  );
  assert.equal(
    missionFitsSavedContext(mission("a", "Stretch", { minutes: 120 }), moment),
    false,
  );
  assert.equal(
    missionFitsSavedContext(
      mission("a", "Normal", {
        mission_text: "Write a resume with your teenager",
        ages: [],
      }),
      moment,
    ),
    false,
  );
  assert.equal(
    missionFitsSavedContext(mission("a", "Normal"), { ...moment, ages: [] }),
    false,
  );
});

test("server never assembles one easy idea with another family's larger sizes", () => {
  const moment = {
    ...missionMoment("America/New_York", new Date("2026-11-16T23:00:00Z")),
    ages: ["under 6"],
    priority: "kind",
    where: "with my kids",
    kind: "place",
  };
  const trio = [
    mission("a", "5-minute"),
    mission("b", "Normal"),
    mission("c", "Stretch"),
  ];
  assert.equal(matchingFamily(trio, moment)?.length, 3);
  assert.equal(
    matchingFamily(
      [{ ...trio[0], family_id: "other" }, ...trio.slice(1)],
      moment,
    ),
    undefined,
  );
  const alternative = trio.map((row) => ({
    ...row,
    id: `new-${row.id}`,
    family_id: "other-idea",
  }));
  assert.deepEqual(
    matchingFamily([...trio, ...alternative], moment, [trio[1].id]),
    alternative,
    "passing one size excludes all three sizes of that family",
  );
  assert.equal(matchingFamily(trio, moment, [trio[0].id]), undefined);
});

test("passing a personal idea generates a new family and retains the refused rows", async () => {
  const sizes = ["5-minute", "Normal", "Stretch"] as const;
  const stored = new Map<string, PersonalMission>();
  let oldRows: PersonalMission[] = [];
  let requests = 0;
  const { client } = nightDatabase();
  let savedRows: PersonalMission[] = [];
  const scoped = {
    ...client,
    rpc: async () => ({ data: [...stored.values()], error: null }),
  };
  const admin = {
    from: (table: string) => {
      assert.equal(table, "missions");
      return {
        upsert: (rows: PersonalMission[]) => {
          savedRows = rows;
          for (const row of rows) stored.set(row.id, row);
          return { select: async () => ({ data: rows, error: null }) };
        },
      };
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    const context = JSON.parse(request.messages[0].content);
    requests++;
    if (requests === 2)
      assert.ok(context.passed_ideas.includes(oldRows[0].mission_text));
    else assert.deepEqual(context.passed_ideas, []);
    return Response.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            family_title: "Find a short melody by ear",
            theme: "",
            missions: sizes.map((size, index) => ({
              size,
              mission_text: (requests === 1
                ? [
                    "Practise one familiar chord",
                    "Practise a sequence of familiar chords",
                    "Play one song with familiar chords",
                  ]
                : [
                    "Find three notes by ear",
                    "Find the melody of one short song",
                    "Learn and record one short melody",
                  ])[index],
              first_step: "Choose a familiar tune",
              minutes: [5, 25, 45][index],
              cost: "Free",
              setting: "Home",
              safety_note: "",
              ages: [],
            })),
          }),
        },
      ],
    });
  };
  try {
    const initial = await personalMissions(
      scoped as never,
      admin as never,
      "owner",
      { interest: "playing ukulele", ladder_step: 1 },
      "test-key",
      "test-model",
    );
    oldRows = initial.missions;
    const result = await personalMissions(
      scoped as never,
      admin as never,
      "owner",
      {
        interest: "playing ukulele",
        ladder_step: 1,
        excluded_mission_ids: [oldRows[0].id],
      },
      "test-key",
      "test-model",
    );
    assert.equal(result.missions.length, 3);
    assert.equal(requests, 2);
    assert.equal(new Set(savedRows.map((row) => row.family_id)).size, 1);
    assert.ok(
      savedRows.every(
        (row) =>
          row.family_id !== oldRows[0].family_id &&
          !oldRows.some((old) => old.id === row.id),
      ),
    );
    assert.equal(stored.size, 6);
    assert.ok(oldRows.every((row) => stored.get(row.id) === row));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a custom interest keeps its exact tag when an older client sends an empty where", async () => {
  const rows = (["5-minute", "Normal", "Stretch"] as const).map((size) =>
    mission(`ukulele-${size}`, size, {
      tags: ["playing ukulele"],
      priorities: [],
      interests: ["playing ukulele"],
      places: [],
      ages: [],
    }),
  );
  const { client } = nightDatabase();
  const scoped = { ...client, rpc: async () => ({ data: rows, error: null }) };
  const result = await personalMissions(
    scoped as never,
    scoped as never,
    "owner",
    {
      interest: "playing ukulele",
      ladder_step: 1,
      where: "",
    },
    "",
    "test-model",
  );
  assert.equal(result.missions.length, 3);
  assert.ok(
    result.missions.every((row) => row.interests?.includes("playing ukulele")),
  );
  await assert.rejects(
    personalMissions(
      scoped as never,
      scoped as never,
      "owner",
      {
        interest: "kind",
        ladder_step: 1,
        kind: "place",
        where: "",
      },
      "",
      "test-model",
    ),
    /Choose who or where/,
  );
});

test("Round 3 prompt uses the when question and This year list, with once-only preferences", () => {
  assert.equal(PROMPT_VERSION, "chloe-2026-11-18-round3");
  assert.match(MODES.morning, /When will you do it\?/);
  assert.match(MODES.monthly, /this_year_items/);
  const prompt = systemPrompt("monthly", {});
  assert.match(prompt, /I'm Chloe\. You do the living/);
  assert.match(prompt, /asked=true means never ask again/);
  assert.doesNotMatch(prompt, /Here.s your One year\s+out picture/);
});
