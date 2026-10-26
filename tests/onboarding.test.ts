import test from "node:test";
import assert from "node:assert/strict";
import {
  firstSessionStep,
  isUnreadyAnswer,
  pickObservation,
  quickPickState,
  suggestedFirstValue,
  validCheckInTime,
} from "../src/onboarding";
test("uncertainty stays open instead of becoming an interest or a why", () => {
  for (const answer of [
    "",
    "I don't know yet",
    "I don’t know.",
    "Not sure",
    "idk",
    "Still forming",
    "I'm not ready yet",
  ])
    assert.equal(isUnreadyAnswer(answer), true, answer);
  assert.equal(
    isUnreadyAnswer("I don't know yet, but I want to help my family"),
    false,
  );
  assert.equal(
    isUnreadyAnswer("A patient father who makes time to listen"),
    false,
  );
});
test("earlier discovery drafts retain their place while retiring score questions", () => {
  assert.equal(firstSessionStep(0, 1), 1);
  assert.equal(firstSessionStep(0, 2), 3);
  assert.equal(firstSessionStep(0, 3), 6);
  assert.equal(firstSessionStep(0, 4), 8);
  assert.equal(firstSessionStep(2, 11), 11);
});
test("quick picks preserve explicit love without fabricating experience for curiosity", () => {
  assert.equal(quickPickState("love"), "love");
  assert.equal(quickPickState("curious"), "spark");
  assert.equal(quickPickState("pass"), null);
  assert.equal(quickPickState(""), null);
  const observation = pickObservation([
    { title: "Teaching", choice: "love" },
    { title: "Pottery", choice: "curious" },
  ]);
  assert.match(observation, /Teaching already has a place/);
  assert.match(observation, /Pottery is something you might explore/);
  assert.doesNotMatch(observation, /gift|strength|talent|score|\d/);
});
test("a possible value remains grounded in a story or a curious choice", () => {
  assert.equal(
    suggestedFirstValue(["I admire her kindness."], false),
    "Kindness",
  );
  assert.equal(suggestedFirstValue(["We were at the lake."], false), null);
  assert.equal(suggestedFirstValue([], true), "Curiosity");
});
test("check-in anchors accept only actual clock times", () => {
  assert.equal(validCheckInTime("08:00"), true);
  assert.equal(validCheckInTime("23:59"), true);
  for (const invalid of ["24:00", "08:60", "8:00", "after coffee", ""])
    assert.equal(validCheckInTime(invalid), false);
});
