import assert from "node:assert/strict";
import test from "node:test";
import { checkInInput, type CheckIn } from "../src/domain";

test("reflection persistence retains explicit energy for all outcomes and revision metadata", () => {
  for (const outcome of ["yes", "partly", "not_yet"] as const) {
    for (const energy of ["lit", "neutral", "drained"] as const) {
      const input = {
        intention_id: "priority-focus",
        outcome,
        energy,
        reflection: "My own words",
        revision: 4,
      };
      assert.deepEqual(checkInInput(input), input);
    }
  }
});

test("unanswered energy remains null instead of being inferred from the outcome", () => {
  for (const outcome of ["yes", "partly", "not_yet"] as const) {
    const input = { intention_id: "priority-focus", outcome, reflection: "" };
    assert.equal(checkInInput(input).energy, null);
    assert.equal(checkInInput({ ...input, energy: null }).energy, null);
  }
});

test("invalid energy cannot enter local practice before server validation", () => {
  assert.throws(
    () =>
      checkInInput({
        intention_id: "priority-focus",
        outcome: "yes",
        reflection: "",
        energy: "happy" as CheckIn["energy"],
      }),
    /choose an energy answer/,
  );
});
