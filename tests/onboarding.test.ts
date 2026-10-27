import test from "node:test";
import assert from "node:assert/strict";
import {
  firstSessionStep,
  firstSessionQuestionAvailable,
  previousFirstSessionStep,
  isUnreadyAnswer,
  pickObservation,
  quickPickState,
  suggestedFirstValue,
  shouldOfferStoryFollowUp,
  storyBody,
  storyFollowUp,
  validCheckInTime,
} from "../src/onboarding";
import { emptyPractice } from "../src/domain";
import { entryInput } from "../src/journey";
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
  assert.equal(firstSessionStep(2, 2), 3);
  assert.equal(firstSessionStep(2, 10), 11);
  assert.equal(firstSessionStep(2, 12), 13);
  assert.equal(firstSessionStep(3, 10), 10);
});
test("the shorter flow returns to the previous real question", () => {
  assert.equal(previousFirstSessionStep(3), 1);
  assert.equal(previousFirstSessionStep(11), 9);
  assert.equal(previousFirstSessionStep(13), 11);
  assert.equal(previousFirstSessionStep(10), 13);
  assert.equal(previousFirstSessionStep(12), 10);
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
  assert.equal(
    suggestedFirstValue(
      ["She was never patient, but I admired her courage."],
      false,
    ),
    "Courage",
  );
  assert.equal(suggestedFirstValue(["I like that kind of game."], false), null);
  assert.equal(
    suggestedFirstValue(
      ["I don't want to be patient. I value honesty."],
      false,
    ),
    "Honesty",
  );
});
test("keeping only the main story omits a typed or previously accepted follow-up", () => {
  const question = "What about it stayed with you?";
  assert.equal(
    storyBody(
      " Making a bowl. ",
      "A detail I decided not to keep.",
      question,
      false,
    ),
    "Making a bowl.",
  );
  assert.equal(
    storyBody("Making a bowl.", "The shared quiet.", question, true),
    "Making a bowl.\n\nWhat about it stayed with you?\nThe shared quiet.",
  );
  assert.equal(
    storyBody("Making a bowl.", "I don't know yet", question, true),
    "Making a bowl.",
  );
});
test("a short contextual follow-up is offered at most once automatically", () => {
  assert.equal(
    shouldOfferStoryFollowUp("I was repairing a bike with my daughter", false),
    true,
  );
  assert.equal(
    shouldOfferStoryFollowUp("I was repairing a bike with my daughter", true),
    false,
  );
  assert.equal(shouldOfferStoryFollowUp("Not sure", false), false);
  assert.equal(
    storyFollowUp(2, "My sister"),
    "What exactly do you admire about them?",
  );
  assert.equal(
    storyFollowUp(2, "My sister, for her courage"),
    "When did you last see that in them?",
  );
  assert.equal(
    storyFollowUp(0, "Making a bowl with a friend"),
    "What about being together stayed with you?",
  );
});
test("check-in anchors accept only actual clock times", () => {
  assert.equal(validCheckInTime("08:00"), true);
  assert.equal(validCheckInTime("23:59"), true);
  for (const invalid of ["24:00", "08:60", "8:00", "after coffee", ""])
    assert.equal(validCheckInTime(invalid), false);
});
test("optional synthesis cannot immediately reoffer skipped, stopped or deferred questions", () => {
  const question = "What about it pulled you in?";
  const now = new Date("2026-10-26T12:00:00Z");
  const practice = emptyPractice();
  practice.profile.timezone = "UTC";
  assert.equal(firstSessionQuestionAvailable(practice, question, now), true);
  for (const extra of [
    { state: "stopped" },
    { meta: { next_day: "2026-10-28" } },
    {
      meta: {
        last_asked_session: "first-session",
        last_asked_at: "2026-10-25T12:00:00Z",
      },
    },
    { meta: { last_asked_at: "2026-10-26T10:00:00Z" } },
  ]) {
    practice.entries = [
      {
        ...entryInput("question", question, extra),
        id: "question",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];
    assert.equal(
      firstSessionQuestionAvailable(practice, question.toUpperCase(), now),
      false,
    );
  }
});
