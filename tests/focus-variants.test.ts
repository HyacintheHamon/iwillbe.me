import test from "node:test";
import assert from "node:assert/strict";
import { emptyPractice } from "../src/domain";
import { MISSIONS, type Round2Mission } from "../src/round2";
import { contextForMission, distinctEasyMission } from "../src/focus-variants";

const now = new Date("2026-11-26T14:00:00Z");
const mission = (
  id: string,
  family: string,
  level = "easy",
  overrides: Partial<Round2Mission> = {},
): Round2Mission => ({
  ...MISSIONS[0],
  id,
  family_id: family,
  level,
  priorities: ["kind"],
  interests: ["baking"],
  places: ["with my friends"],
  mission_text: "Make a small batch of cookies for a friend.",
  first_step: "Choose one recipe.",
  setting: "Home",
  minutes: level === "easy" ? 5 : 20,
  ...overrides,
});

test("replacing a focus removes incompatible interest/place tags and uses the new mission's priority", () => {
  const candidate = mission("new-a", "new");
  assert.deepEqual(
    contextForMission(candidate, {
      priority: "healthy",
      interest: "hiking",
      place: "with my kids",
    }),
    { priority: "kind", interest: "", place: "" },
  );
  assert.deepEqual(
    contextForMission(candidate, {
      priority: "kind",
      interest: "Baking",
      place: "with my friends",
    }),
    { priority: "kind", interest: "Baking", place: "with my friends" },
  );
});

test("Another idea rejects every size in the existing family and only accepts a different Easy mission", () => {
  const practice = emptyPractice();
  practice.profile.timezone = "America/New_York";
  const current = mission(
    "personal-owner-hash-Normal",
    "personal-owner-hash",
    "normal",
  );
  const sameEasy = mission(
    "personal-owner-hash-5-minute",
    "personal-owner-hash",
  );
  const differentNormal = mission(
    "personal-owner-other-Normal",
    "personal-owner-other",
    "normal",
  );
  const differentEasy = mission(
    "personal-owner-other-5-minute",
    "personal-owner-other",
  );
  assert.equal(
    distinctEasyMission(
      [sameEasy, differentNormal, differentEasy],
      current,
      current.id,
      practice,
      now,
    )?.id,
    differentEasy.id,
  );
  assert.equal(
    distinctEasyMission(
      [sameEasy, differentNormal],
      current,
      current.id,
      practice,
      now,
    ),
    undefined,
  );
});

test("the fallback list cannot reintroduce a different size of the same public family", () => {
  const practice = emptyPractice();
  const current = mission("old-1b", "old-1", "normal");
  const same = mission("old-1a", "old-1");
  const next = mission("new-1a", "new-1");
  assert.equal(
    distinctEasyMission([same, next], current, current.id, practice, now)?.id,
    next.id,
  );
});

test("an Easy alternative still respects saved ages and current-time eligibility", () => {
  const practice = emptyPractice();
  practice.profile.timezone = "America/New_York";
  const current = mission("old-1a", "old-1");
  const ageSpecific = mission("age-1a", "age-1", "easy", { ages: ["teens"] });
  const expired = mission("timed-1a", "timed-1", "easy", {
    mission_text: "Send one note before 10am.",
  });
  assert.equal(
    distinctEasyMission(
      [ageSpecific, expired],
      current,
      current.id,
      practice,
      new Date("2026-11-26T17:00:00Z"),
    ),
    undefined,
  );
});
