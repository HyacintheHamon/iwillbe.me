import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STARTER_MISSIONS,
  matchingMissions,
  missionTrio,
} from "../supabase/functions/_shared/missions";
import {
  shortlistThoughts,
  type NightThought,
  type ThoughtHistory,
} from "../supabase/functions/_shared/night-thoughts";
import { supportLevel } from "../supabase/functions/_shared/safety";
import { PRIORITY_WORDS, QUICK_PICKS } from "../src/priorities";
import { emptyPractice } from "../src/domain";
import { entryInput, interestState, type Entry } from "../src/journey";
import { ladderStep } from "../src/mission-progress";
import { beneficiaries, detectBeneficiary } from "../src/beneficiaries";
import { parseCSV, normalizeMissions } from "../scripts/import-missions";
const catalogue = JSON.parse(
  readFileSync(new URL("../data/night-thoughts.json", import.meta.url), "utf8"),
) as NightThought[];

test("every onboarding interest and priority has a concrete starter trio", () => {
  assert.equal(QUICK_PICKS.length, 15);
  assert.equal(PRIORITY_WORDS.length, 38);
  assert.equal(STARTER_MISSIONS.length, 159);
  assert.equal(new Set(STARTER_MISSIONS.map((m) => m.id)).size, 159);
  for (const tag of [
    ...QUICK_PICKS.map((p) => p.title),
    ...PRIORITY_WORDS.map((p) => p.name),
  ]) {
    const trio = missionTrio(matchingMissions(STARTER_MISSIONS, tag));
    assert.deepEqual(
      trio.map((m) => m.size),
      ["5-minute", "Normal", "Stretch"],
      tag,
    );
    assert.ok(
      trio.every(
        (m) =>
          m.mission_text.length <= 500 && m.first_step && m.ladder_step === 1,
      ),
    );
  }
  assert.equal(matchingMissions(STARTER_MISSIONS, "Photography").length, 3);
  assert.equal(matchingMissions(STARTER_MISSIONS, "photography", 2).length, 0);
});

test("only completed linked missions advance the ladder, with no double count or stage change", () => {
  const p = emptyPractice();
  const entry = {
    ...entryInput("interest", "reading", { state: "want_to_try" }),
    id: "reading",
    created_at: "",
    updated_at: "",
  } as Entry;
  p.entries = [entry];
  p.intentions = [
    {
      id: "a",
      day: "2026-11-01",
      action: "Read",
      value: "",
      person: "",
      interest_id: entry.id,
      mission_id: "starter-reading-1",
      mission_step: 1,
      created_at: "",
    },
  ];
  assert.equal(ladderStep(p, entry), 1);
  p.checkIns = [
    { intention_id: "a", outcome: "not_yet", reflection: "", created_at: "" },
  ];
  assert.equal(ladderStep(p, entry), 1);
  p.checkIns[0].outcome = "yes";
  assert.equal(ladderStep(p, entry), 2);
  assert.equal(ladderStep(p, entry), 2);
  assert.equal(interestState(p, entry), "Want to try");
  p.intentions.push({ ...p.intentions[0], id: "b", day: "2026-11-02" });
  p.checkIns.push({ ...p.checkIns[0], intention_id: "b" });
  assert.equal(
    ladderStep(p, entry),
    2,
    "repeating step one does not skip step two",
  );
  p.intentions[1].mission_step = 5;
  assert.equal(ladderStep(p, entry), 5);
});

test("beneficiaries preserve recent named people and only auto-pick an explicit match", () => {
  const p = emptyPractice();
  p.intentions = [
    {
      id: "1",
      day: "",
      action: "",
      value: "",
      person: "Jo",
      created_at: "2026-10-01",
    },
    {
      id: "2",
      day: "",
      action: "",
      value: "",
      person: "Sam",
      created_at: "2026-11-01",
    },
  ];
  const names = beneficiaries(p);
  assert.deepEqual(names, [
    "Sam",
    "Jo",
    "Family",
    "Friends",
    "Colleagues",
    "Community",
    "For me",
  ]);
  assert.equal(detectBeneficiary("Join a club", names), null);
  assert.equal(detectBeneficiary("Cook for Jo", names)?.name, "Jo");
  assert.deepEqual(
    detectBeneficiary("Pick up litter for my community", names),
    { name: "Community", match: "my community" },
  );
  assert.equal(detectBeneficiary("Read a chapter", names), null);
});

test("night library retains all supplied records while withholding caveated entries", () => {
  assert.equal(catalogue.length, 209);
  assert.equal(catalogue.filter((t) => t.status === "verified").length, 200);
  assert.equal(catalogue.find((t) => t.id === 142)?.status, "needs_check");
  assert.ok(
    catalogue.every((t) =>
      t.priorities.every((p) => PRIORITY_WORDS.some((w) => w.name === p)),
    ),
    "tags match the 38 priorities",
  );
});
const thought = (
  id: number,
  patch: Partial<NightThought> = {},
): NightThought => ({
  id,
  format: "quote",
  text: "A line",
  person: `Person ${id}`,
  source: "Source",
  credit: "Person, Source",
  priorities: ["kind"],
  traditions: [],
  once_only: false,
  status: "verified",
  ...patch,
});
test("night thoughts enforce 180 days, lifetime once-only and no consecutive author", () => {
  const now = new Date("2026-11-03T20:00:00Z");
  const history: ThoughtHistory[] = [
    { thought_id: 1, shown_at: "2026-10-01", snapshot: thought(1) },
    { thought_id: 2, shown_at: "2025-01-01", snapshot: thought(2) },
    {
      thought_id: 3,
      shown_at: "2026-11-02",
      snapshot: thought(3, { person: "Same author" }),
    },
  ];
  const pool = [
    thought(1),
    thought(2, { once_only: true }),
    thought(3),
    thought(4, { person: "Same author" }),
    thought(5),
    thought(6, { status: "needs_check" }),
  ];
  assert.deepEqual(
    shortlistThoughts(pool, history, ["kind"], [], null, now).map((t) => t.id),
    [5],
  );
  assert.deepEqual(
    shortlistThoughts([thought(2)], history, [], [], null, now).map(
      (t) => t.id,
    ),
    [2],
  );
});
test("faith thoughts need both explicit priority and a matching private tradition", () => {
  const pool = [
    thought(1, { priorities: ["guided by faith"], traditions: ["Christian"] }),
    thought(2, { priorities: ["guided by faith"], traditions: ["Buddhist"] }),
    thought(3),
  ];
  assert.deepEqual(
    shortlistThoughts(pool, [], ["guided by faith"], [], "Christian").map(
      (t) => t.id,
    ),
    [1, 3],
  );
  for (const faith of [null, "Prefer not to say"])
    assert.deepEqual(
      shortlistThoughts(pool, [], ["guided by faith"], [], faith).map(
        (t) => t.id,
      ),
      [3],
    );
  assert.deepEqual(
    shortlistThoughts(pool, [], [], [], "Christian").map((t) => t.id),
    [3],
  );
  assert.equal(
    shortlistThoughts(
      pool,
      [],
      ["guided by faith"],
      [],
      "Spiritual, from many traditions",
    ).length,
    3,
  );
});
test("working priorities outrank other matching themes", () => {
  const pool = [
    thought(1, { priorities: ["kind"] }),
    thought(2, { priorities: ["patient"] }),
  ];
  assert.equal(
    shortlistThoughts(pool, [], ["patient"], ["kind"], null)[0].id,
    2,
  );
});
test("mission CSV preserves quoted commas/newlines and rejects invalid rows before import", () => {
  const text =
    'ID,Mission text,First step,Area,Tags,Quick picks,Priorities,Who it’s for,Ladder step,Stage,Size,Minutes,Cost,Setting,Safety note\r\nM-1,"Read, then share\na chapter",Open a book,Passions,reading,reading,curious; always learning,friend,1,Maybe,Normal,20,Free,Home,\r\n';
  const records = parseCSV(text),
    rows = normalizeMissions(records);
  assert.equal(rows[0].mission_text, "Read, then share\na chapter");
  assert.deepEqual(rows[0].priorities, ["curious", "always learning"]);
  assert.deepEqual(rows[0].who_for, ["friend"]);
  assert.throws(
    () => normalizeMissions([records[0], records[0]]),
    /duplicate ID/,
  );
  assert.throws(
    () => normalizeMissions([{ ...records[0], Minutes: "-1" }]),
    /invalid minutes/,
  );
  assert.throws(() => parseCSV('ID,Text\n1,"unfinished'), /Unclosed/);
});
test("explicit distress is held while ordinary metaphors are not classified as crisis", () => {
  assert.equal(supportLevel("I want to kill myself"), 3);
  assert.equal(supportLevel("I am dying to try pottery"), 0);
  assert.equal(
    supportLevel("I want to learn more about suicide prevention for a class"),
    0,
  );
});
