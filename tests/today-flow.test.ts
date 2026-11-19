import assert from "node:assert/strict";
import { test } from "node:test";
import { localHour, planChoices, pendingFromMission } from "../src/today-flow";
import { MISSIONS } from "../src/round2";

test("Today changes the planning choices at 5 pm in the person's timezone", () => {
  assert.deepEqual(
    planChoices(
      localHour("America/New_York", new Date("2026-11-19T21:59:00Z")),
    ),
    ["morning", "lunch", "after work", "bedtime"],
  );
  assert.deepEqual(
    planChoices(
      localHour("America/New_York", new Date("2026-11-19T22:00:00Z")),
    ),
    ["now", "after dinner", "at bedtime"],
  );
  assert.deepEqual(
    planChoices(
      localHour("America/Los_Angeles", new Date("2026-11-19T22:00:00Z")),
    ),
    ["morning", "lunch", "after work", "bedtime"],
  );
});

test("local planning follows daylight saving and a bad timezone cannot break Today", () => {
  assert.equal(
    localHour("America/New_York", new Date("2026-07-19T21:00:00Z")),
    17,
  );
  assert.equal(
    localHour("not-a-timezone", new Date("2026-11-19T22:00:00Z")),
    22,
  );
  assert.equal(
    localHour("America/New_York", new Date("2026-11-20T05:00:00Z")),
    0,
  );
});

test("a pending suggestion preserves its chosen variant and Someday link before a plan is saved", () => {
  const mission = MISSIONS.find((item) => item.id === "KK-05b")!;
  const pending = pendingFromMission(mission, {
    priority: "kind",
    place: "with my kids",
    somedayId: "saved-someday",
  });
  assert.equal(pending.missionId, "KK-05b");
  assert.equal(pending.level, "normal");
  assert.equal(pending.text, mission.mission_text);
  assert.equal(pending.place, "with my kids");
  assert.equal(pending.somedayId, "saved-someday");
  assert.equal(pending.source, "suggested");
  assert.equal("when_context" in pending, false);
});
