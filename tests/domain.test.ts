import test from "node:test";
import assert from "node:assert/strict";
import { activityCount, emptyPractice, localDay } from "../src/domain";
test("galaxy grows only from real-world action and cannot double count one reflection", () => {
  const p = emptyPractice();
  p.intentions = [
    {
      id: "a",
      day: "2026-10-19",
      action: "Listen",
      value: "Patience",
      person: "Sam",
      created_at: "",
    },
  ];
  assert.equal(activityCount(p, "Patience"), 0);
  p.checkIns = [
    { intention_id: "a", outcome: "not_yet", reflection: "", created_at: "" },
  ];
  assert.equal(activityCount(p, "Patience"), 0);
  p.checkIns[0].outcome = "partly";
  assert.equal(activityCount(p, "Patience"), 1);
  p.checkIns.push({ ...p.checkIns[0] });
  assert.equal(activityCount(p, "Patience"), 1);
  assert.equal(activityCount(p, "Curiosity"), 0);
});
test("daily intention uses local calendar day, not the UTC date", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/New_York";
  assert.equal(localDay(new Date("2026-10-20T00:30:00Z")), "2026-10-19");
  assert.equal(localDay(new Date("2026-11-01T06:30:00Z")), "2026-11-01");
  process.env.TZ = old;
});
