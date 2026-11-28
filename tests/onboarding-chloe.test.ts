import assert from "node:assert/strict";
import test from "node:test";
import { MASTER_PROMPT } from "../supabase/functions/chloe/master-prompt";
import {
  PROMPT_VERSION,
  systemPrompt,
} from "../supabase/functions/chloe/prompt";
import { onboardingFlowContext } from "../supabase/functions/chloe/onboarding-schedule";
import {
  round2Action,
  round2Context,
} from "../supabase/functions/chloe/round2";

const schedule = {
  kind: "preferences",
  title: "Onboarding schedule",
  meta: {
    version: "one-minute-v1",
    completed_day: "2026-11-27",
    completed_at: "2026-11-27T18:00:00Z",
  },
};
const followup = (key: string, day: string, status = "answered") => ({
  kind: "preferences",
  title: "Onboarding follow-up",
  body: "A saved app question",
  meta: { followup_key: key, asked_day: day, followup_status: status },
});

test("Chloe uses the full November 26 prompt and explicitly separates app-owned onboarding", () => {
  assert.equal(PROMPT_VERSION, "chloe-2026-11-26-onboarding-v2");
  assert.match(MASTER_PROMPT, /first session takes about one minute/);
  assert.match(MASTER_PROMPT, /pick exactly 7/);
  assert.match(MASTER_PROMPT, /all 7 save as Working on/);
  assert.match(MASTER_PROMPT, /FIRST TWO WEEKS/);
  assert.match(MASTER_PROMPT, /under 6, 6–12, teens,\s+adults/);
  assert.doesNotMatch(
    MASTER_PROMPT,
    /Page \d+|Change log|Chloe — Master Prompt/,
  );
  const prompt = systemPrompt("night", {});
  assert.match(prompt, /first My why is mandatory/);
  assert.match(prompt, /08:00 and 21:00/);
  assert.match(prompt, /only a separate yes changes its state/);
  assert.match(prompt, /28 days/);
  assert.match(prompt, /no repeated questions or reflection_proposal/);
});

test("Sunday progress follows visited sessions and keeps the baseline after a missed Sunday", () => {
  assert.equal(
    onboardingFlowContext([schedule], "2026-11-29").onboarding_sunday_phase,
    1,
  );
  assert.equal(
    onboardingFlowContext([schedule], "2026-12-13").onboarding_sunday_phase,
    1,
  );
  const first = followup("sunday:1", "2026-12-13");
  assert.equal(
    onboardingFlowContext([schedule, first], "2026-12-13")
      .onboarding_sunday_phase,
    1,
  );
  assert.equal(
    onboardingFlowContext([schedule, first], "2026-12-20")
      .onboarding_sunday_phase,
    2,
  );
  assert.equal(
    onboardingFlowContext([schedule, first], "2026-12-14")
      .onboarding_sunday_phase,
    null,
  );
  assert.equal(
    onboardingFlowContext([], "2026-12-13").onboarding_sunday_phase,
    null,
  );
});

test("Sunday completion survives a crash before the final phase marker", () => {
  const firstAnswers = [
    schedule,
    followup("sunday:1:baseline", "2026-11-29"),
    followup("sunday:1:childhood", "2026-11-29", "skipped"),
    followup("sunday:1:strengths", "2026-11-29"),
  ];
  const sameSunday = onboardingFlowContext(firstAnswers, "2026-11-29");
  assert.equal(sameSunday.onboarding_sunday_phase, 1);
  assert.equal(sameSunday.onboarding_regular_why_question, null);
  assert.equal(
    onboardingFlowContext(firstAnswers, "2026-12-06").onboarding_sunday_phase,
    2,
  );
  const incomplete = [
    schedule,
    followup("sunday:1:baseline", "2026-11-29", "shown"),
    ...firstAnswers.slice(2),
  ];
  assert.equal(
    onboardingFlowContext(incomplete, "2026-12-06").onboarding_sunday_phase,
    1,
    "A reservation does not complete the baseline",
  );
  const bothAnswers = [
    ...firstAnswers,
    followup("sunday:2:help", "2026-12-06"),
    followup("sunday:2:growth", "2026-12-06", "skipped"),
  ];
  const secondSunday = onboardingFlowContext(bothAnswers, "2026-12-06");
  assert.equal(secondSunday.onboarding_sunday_phase, 2);
  assert.equal(secondSunday.onboarding_regular_why_question, null);
  const followingSunday = onboardingFlowContext(bothAnswers, "2026-12-13");
  assert.equal(followingSunday.onboarding_sunday_phase, null);
  assert.equal(
    followingSunday.onboarding_regular_why_question,
    "When did time disappear on you recently?",
  );
});

test("the first two regular Sunday questions resume in order after both discovery reviews", () => {
  const entries = [
    schedule,
    followup("sunday:1", "2026-11-29"),
    followup("sunday:2", "2026-12-06"),
  ];
  assert.equal(
    onboardingFlowContext(entries, "2026-12-06").onboarding_sunday_phase,
    2,
  );
  assert.equal(
    onboardingFlowContext(entries, "2026-12-20")
      .onboarding_regular_why_question,
    "When did time disappear on you recently?",
  );
  const reviews = [
    {
      kind: "review",
      title: "Sunday review",
      state: "done",
      meta: { period: "week:2026-12-20" },
    },
  ];
  assert.equal(
    onboardingFlowContext([...entries, ...reviews], "2026-12-20")
      .onboarding_regular_why_question,
    "When did time disappear on you recently?",
  );
  assert.equal(
    onboardingFlowContext([...entries, ...reviews], "2026-12-27")
      .onboarding_regular_why_question,
    "Who do you admire, and why?",
  );
  reviews.push({
    kind: "review",
    title: "Sunday review",
    state: "done",
    meta: { period: "week:2026-12-27" },
  });
  assert.equal(
    onboardingFlowContext([...entries, ...reviews], "2027-01-03")
      .onboarding_regular_why_question,
    null,
  );
});

test("a shown, answered or skipped app card reserves its local night once", () => {
  for (const status of ["shown", "answered", "skipped"]) {
    const entries = [schedule, followup("reminders", "2026-11-27", status)];
    assert.equal(
      onboardingFlowContext(entries, "2026-11-27")
        .onboarding_night_question_today,
      true,
    );
    assert.equal(
      onboardingFlowContext(entries, "2026-11-28")
        .onboarding_night_question_today,
      false,
    );
  }
  assert.equal(
    onboardingFlowContext(
      [followup("sunday:1:strengths", "2026-11-29")],
      "2026-11-29",
    ).onboarding_night_question_today,
    false,
  );
});

type Row = Record<string, unknown>;
function database(entries: Row[], moments: Row[] = []) {
  let reservations = 0;
  const tables: Record<string, Row[]> = {
    profiles: [
      { id: "owner", timezone: "UTC", joined_at: "2026-11-27T18:00:00Z" },
    ],
    journey_entries: entries.map((entry, index) => ({
      user_id: "owner",
      id: `entry-${index}`,
      kind: entry.kind,
      entry,
    })),
    chloe_moments: moments,
  };
  const client = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let single = false;
      const result = () => {
        const rows = (tables[table] || []).filter((row) =>
          filters.every(([key, value]) => row[key] === value),
        );
        return { data: single ? rows[0] || null : rows, error: null };
      };
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        single: () => {
          single = true;
          return Promise.resolve(result());
        },
        maybeSingle: () => {
          single = true;
          return Promise.resolve(result());
        },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
    rpc: async () => {
      reservations += 1;
      return { data: "reserved", error: null };
    },
  };
  return { client, reservations: () => reservations };
}

test("Sunday endpoint suppresses competing questions, cached rare moments and provider calls", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-11-29T14:00:00Z"),
  });
  const db = database(
    [schedule],
    [
      {
        user_id: "owner",
        session_id: "sunday:2026-11-29",
        type: "narrowing",
        payload: { reflection: "A stale question?" },
      },
    ],
  );
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Provider should not be called for app-owned discovery");
  });
  const context = await round2Context(db.client as never, "owner");
  assert.equal(context.onboarding_sunday_phase, 1);
  assert.equal(context.onboarding_schedule?.completed_day, "2026-11-27");
  const result = await round2Action(
    db.client as never,
    db.client as never,
    "owner",
    { action: "round2_review" },
    "test",
    "test",
  );
  assert.equal(result.onboarding_phase, 1);
  assert.equal(result.reflection, "");
  assert.equal(result.question, "");
  assert.equal(result.pattern, "");
  assert.equal(result.moment, null);
  assert.equal(fetch.mock.callCount(), 0);
  const rare = await round2Action(
    db.client as never,
    db.client as never,
    "owner",
    {
      action: "round2_moment",
      type: "narrowing",
      session_id: "sunday:2026-11-29",
    },
    "test",
    "test",
  );
  assert.equal(rare.moment, null);
  assert.equal(db.reservations(), 0);
});

test("Sunday endpoint enforces the third review's exact Why question over a model alternative", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-12-13T14:00:00Z"),
  });
  const db = database([
    schedule,
    followup("sunday:1", "2026-11-29"),
    followup("sunday:2", "2026-12-06"),
  ]);
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                intro: "A little reflection.",
                pattern: "",
                reflection: "A competing question?",
                question: "Another competing question?",
              }),
            },
          ],
        }),
      ),
  );
  const result = await round2Action(
    db.client as never,
    db.client as never,
    "owner",
    { action: "round2_review" },
    "test",
    "test",
  );
  assert.equal(result.reflection, "When did time disappear on you recently?");
  assert.equal(result.question, "");
  assert.equal(result.moment, null);
  assert.equal(db.reservations(), 0);
});
