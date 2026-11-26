import assert from "node:assert/strict";
import test from "node:test";
import {
  hesitationObstacle,
  obstacleCarryForward,
  obstacleMatchesFocus,
  savedNightObstacles,
  type ObstacleReason,
} from "../supabase/functions/chloe/night-obstacles";
import {
  localContextDay,
  systemPrompt,
} from "../supabase/functions/chloe/prompt";
import {
  round2Action,
  round2Context,
} from "../supabase/functions/chloe/round2";

const day = "2026-11-26";
const obstacle = (
  reason?: ObstacleReason,
  patch: Record<string, unknown> = {},
) => ({
  id: "obstacle",
  kind: "event",
  title: "Night obstacle",
  updated_at: `${day}T23:00:00Z`,
  meta: {
    asked: true,
    focus_day: day,
    focus_key: "same-family",
    intention_id: "focus",
    obstacle_reason: reason,
    suggested_action: "Read the first page.",
    mission_id: "reading-easy",
    ...patch,
  },
});
const focus = { id: "focus", day, outcome: "not_yet" };

test("an unanswered or skipped obstacle is not treated as a reason or tomorrow's action", () => {
  const records = savedNightObstacles(
    [
      obstacle(undefined),
      {
        ...obstacle("big"),
        id: "unasked",
        meta: { ...obstacle("big").meta, asked: false },
      },
      {
        ...obstacle("big"),
        id: "future",
        meta: { ...obstacle("big").meta, focus_day: "2026-11-27" },
      },
    ],
    day,
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].obstacle_reason, null);
  assert.equal(records[0].suggested_action, null);
  assert.equal(obstacleCarryForward(records[0]), null);
  assert.equal(hesitationObstacle(records, [focus], day), null);
});

test("worst-case follows explicit hesitation only, with actual partial/non-completion evidence", () => {
  for (const reason of [
    "time",
    "start",
    "big",
    "motivation",
    "unexpected",
    "unsure",
  ] as const) {
    const records = savedNightObstacles([obstacle(reason)], day);
    const allowed = reason === "big" || reason === "motivation";
    assert.equal(!!hesitationObstacle(records, [focus], day), allowed, reason);
    assert.equal(hesitationObstacle(records, [focus], day, true), null);
    assert.equal(
      hesitationObstacle(records, [{ ...focus, outcome: "yes" }], day),
      null,
    );
    assert.equal(
      hesitationObstacle(records, [{ ...focus, outcome: null }], day),
      null,
    );
    assert.equal(hesitationObstacle(records, [focus], "2026-12-04"), null);
  }
});

test("an older obstacle cannot attach to a replacement focus on the same day", () => {
  const record = savedNightObstacles([obstacle("big")], day)[0];
  assert.equal(
    obstacleMatchesFocus(record, { ...focus, id: "replacement" }),
    false,
  );
  assert.equal(
    hesitationObstacle([record], [{ ...focus, id: "replacement" }], day),
    null,
  );
  assert.equal(
    obstacleMatchesFocus(record, {
      ...focus,
      action: "An entirely new action",
    }),
    false,
    "daily intention IDs stay the same after replacement",
  );
  assert.deepEqual(obstacleCarryForward(record), {
    kind: "carry_forward",
    text: "Read the first page.",
    focus_text: "Read the first page.",
    item_id: null,
    mission_id: "reading-easy",
  });
});

test("Let it go prevents a carried action and any worst-case follow-up", () => {
  const records = savedNightObstacles(
    [obstacle("motivation", { obstacle_choice: "release" })],
    day,
  );
  assert.equal(records[0].obstacle_choice, "release");
  assert.equal(records[0].suggested_action, null);
  assert.equal(obstacleCarryForward(records[0]), null);
  assert.equal(hesitationObstacle(records, [focus], day), null);
});

test("updated obstacle choices supersede old hesitation without turning passes into judgments", () => {
  const old = obstacle("big");
  const latest = {
    ...obstacle("time"),
    id: "latest",
    updated_at: `${day}T23:30:00Z`,
  };
  const records = savedNightObstacles([old, latest], day);
  assert.equal(records.length, 1);
  assert.equal(records[0].obstacle_reason, "time");
  assert.equal(hesitationObstacle(records, [focus], day), null);
});

type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>) {
  const writes: { table: string; value: Row }[] = [];
  let reservations = 0;
  const client = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let one = false;
      let mutation: Row | null = null;
      const run = () => {
        if (mutation) {
          writes.push({ table, value: mutation });
          return { data: mutation, error: null };
        }
        const rows = (tables[table] || []).filter((row) =>
          filters.every(([key, value]) => row[key] === value),
        );
        return { data: one ? rows[0] || null : rows, error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        order: () => query,
        limit: () => query,
        single: () => {
          one = true;
          return Promise.resolve(run());
        },
        maybeSingle: () => {
          one = true;
          return Promise.resolve(run());
        },
        upsert: (value: Row) => {
          mutation = value;
          return query;
        },
        update: (value: Row) => {
          mutation = value;
          return query;
        },
        then: (resolve: (value: ReturnType<typeof run>) => unknown) =>
          Promise.resolve(run()).then(resolve),
      };
      return query;
    },
    rpc: async () => {
      reservations += 1;
      return { data: "reserved", error: null };
    },
  };
  return { client, writes, reservations: () => reservations };
}

function contextRows(reason?: ObstacleReason) {
  const today = localContextDay("America/New_York", new Date());
  const event = obstacle(reason, {
    focus_day: today,
    focus_key: "typed:read a chapter",
  });
  return {
    today,
    tables: {
      profiles: [
        {
          id: "owner",
          timezone: "America/New_York",
          joined_at: "2026-11-01T12:00:00Z",
        },
      ],
      journey_entries: [
        { user_id: "owner", id: event.id, kind: "event", entry: event },
      ],
      intentions: [
        {
          user_id: "owner",
          id: "focus",
          day: today,
          action: "Read a chapter",
          revision: 1,
          source: "typed",
        },
      ],
      check_ins: [
        {
          user_id: "owner",
          intention_id: "focus",
          outcome: "not_yet",
          energy: "neutral",
          revision: 1,
          reflection: "I ran out of time.",
        },
      ],
    } as Record<string, Row[]>,
  };
}

test("night context keeps obstacle sizing private and recap preserves the saved next-day suggestion", async () => {
  const { tables } = contextRows("time");
  const db = database(tables);
  const context = await round2Context(db.client as never, "owner");
  assert.equal(context.current_night_obstacle?.obstacle_reason, "time");
  assert.equal(context.obstacle_sizing[0].reason, "time");
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              summary:
                "Today got crowded. Your smaller step can wait for tomorrow.",
              hard_day: false,
              opener_line: {
                kind: "carry_forward",
                text: "Do a completely different task",
                focus_text: "Different task",
              },
            }),
          },
        ],
      }),
    );
  try {
    const result = await round2Action(
      db.client as never,
      db.client as never,
      "owner",
      { action: "round2_summarize" },
      "test",
      "test",
    );
    assert.equal(result.opener_line.focus_text, "Read the first page.");
    assert.equal(result.opener_line.mission_id, "reading-easy");
    assert.deepEqual(
      db.writes.map((write) => write.table),
      ["checkin_summaries"],
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("direct rare-moment requests cannot bypass the reported-hesitation gate", async () => {
  const { tables } = contextRows("time");
  const db = database(tables);
  const result = await round2Action(
    db.client as never,
    db.client as never,
    "owner",
    {
      action: "round2_moment",
      type: "worst_case",
      session_id: "sunday:2026-11-26",
    },
    "",
    "",
  );
  assert.equal(result.moment, null);
  assert.equal(db.reservations(), 0);
});

test("tagging an explicitly named unknown activity changes only the intention, never My map", async () => {
  const { tables } = contextRows();
  tables.check_ins = [];
  tables.intentions[0].action = "Take a salsa class tonight";
  const db = database(tables);
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              priority: null,
              place: null,
              interest: "salsa dancing",
              interest_evidence: "salsa class",
              someday_item_id: null,
            }),
          },
        ],
      }),
    );
  try {
    await round2Action(
      db.client as never,
      db.client as never,
      "owner",
      { action: "round2_tag_focus" },
      "test",
      "test",
    );
    assert.deepEqual(db.writes, [
      {
        table: "intentions",
        value: { interest: "salsa dancing", interest_id: null },
      },
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("Round 4 screen rules override the older reference paragraphs without importing the changelog", () => {
  const prompt = systemPrompt("night", {});
  assert.match(prompt, /WHEN IT DIDN'T HAPPEN \(night\)/);
  assert.match(prompt, /never wheels/);
  assert.match(prompt, /two groups of three/);
  assert.match(prompt, /no repeated questions or reflection_proposal/);
  assert.match(prompt, /only after an explicit big or motivation obstacle/);
  assert.doesNotMatch(prompt, /Change log|Page \d+ of 25|Design notes/);
});
