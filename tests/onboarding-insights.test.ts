import test from "node:test";
import assert from "node:assert/strict";
import {
  affirmativeValues,
  proposalKey,
  storyProposals,
  validatedOnboardingInsights,
  type OnboardingStory,
} from "../src/onboarding-insights";
import { FIRST_SESSION_STORIES } from "../src/onboarding";

const stories = (...answers: string[]): OnboardingStory[] =>
  FIRST_SESSION_STORIES.map((question, index) => ({
    question,
    answer: answers[index] || "",
  }));

test("guest stories produce distinct grounded possibilities, strengths, admired people and values", () => {
  const input = stories(
    "I was repairing a bike with my daughter. I'm good at explaining things clearly.",
    "I loved drawing animals as a kid.",
    "My sister, for her fairness and the way she listens.",
  );
  const proposals = storyProposals(input);
  assert.deepEqual(
    proposals.map((p) => [p.kind, p.title]),
    [
      ["interest", "Repairing things"],
      ["person", "My sister"],
      ["strength", "Explaining things clearly"],
      ["value", "Fairness"],
    ],
  );
  assert.equal(
    proposals.find((p) => p.kind === "person")?.body,
    "her fairness and the way she listens.",
  );
  for (const proposal of proposals)
    for (const source of proposal.evidence)
      assert.ok(input[source.story_index].answer.includes(source.quote));
  assert.equal(
    validatedOnboardingInsights({ proposals }, input).proposals.length,
    4,
  );
});

test("a childhood activity outside the catalogue retains the person's own words", () => {
  const proposals = storyProposals(
    stories("", "I loved building tiny villages with my brother."),
  );
  assert.equal(proposals[0].title, "Building tiny villages");
  assert.equal(proposals[0].kind, "interest");
});

test("the fallback does not assign another person's activities or admired qualities to the user", () => {
  const proposals = storyProposals(
    stories(
      "My daughter was painting. I loved watching my friend drawing.",
      "I never enjoyed reading. I wanted to try painting.",
      "My father, for his courage and creativity.",
    ),
  );
  assert.equal(proposals.filter((p) => p.kind === "interest").length, 0);
  assert.equal(proposals.filter((p) => p.kind === "strength").length, 0);
  assert.equal(proposals.find((p) => p.kind === "person")?.title, "My father");
});

test("value clues honor negation, contrast, order of mention and common non-value phrases", () => {
  assert.deepEqual(
    affirmativeValues("She was never patient, but I admired her courage.").map(
      (v) => v.title,
    ),
    ["Courage"],
  );
  assert.deepEqual(
    affirmativeValues("I admire his honesty and kindness.").map((v) => v.title),
    ["Honesty", "Kindness"],
  );
  for (const phrase of [
    "That kind of game was fun.",
    "I was a patient at the hospital.",
    "We went to the fair.",
    "To be honest, I liked it.",
    "Kindness isn't what I admire about her.",
    "I felt forced to be brave.",
    "I don't think I'm good at being patient.",
    "He had no patience.",
    "Nobody was kind.",
    "He was kind, but I don't value that.",
  ])
    assert.deepEqual(affirmativeValues(phrase), [], phrase);
  assert.equal(
    affirmativeValues("She is not only kind but also brave.")[0].title,
    "Kindness",
  );
});

test("empty or uncertain stories do not create traits or possibilities", () => {
  assert.deepEqual(
    storyProposals(stories("I don't know yet", "", "No one comes to mind")),
    [],
  );
  assert.deepEqual(
    storyProposals(stories("Something interesting", "", "")),
    [],
  );
});

test("server proposals require exact source quotes and cannot change the Why", () => {
  const input = stories(
    "I was drawing birds.",
    "I loved building models.",
    "My sister, for her kindness.",
  );
  const interest = {
    kind: "interest",
    title: "Drawing",
    body: "Something you described doing.",
    evidence: [{ story_index: 0, quote: "I was drawing birds" }],
  };
  const response = validatedOnboardingInsights(
    {
      proposals: [
        interest,
        {
          ...interest,
          title: "Invented",
          evidence: [{ story_index: 0, quote: "I love quantum physics" }],
        },
        { ...interest, kind: "why", title: "A new why" },
        {
          ...interest,
          title: "Another",
          evidence: [{ story_index: 4, quote: "I was drawing birds" }],
        },
        {
          ...interest,
          kind: "strength",
          title: "Kindness",
          evidence: [{ story_index: 2, quote: "her kindness" }],
        },
      ],
    },
    input,
  );
  assert.deepEqual(response.proposals, [interest]);
});

test("server value proposals cannot use an explicitly rejected value as evidence", () => {
  const input = stories("She was never patient, but I admired her courage.");
  const response = validatedOnboardingInsights(
    {
      proposals: [
        {
          kind: "value",
          title: "Patience",
          body: "Try this on.",
          evidence: [{ story_index: 0, quote: "She was never patient" }],
        },
      ],
    },
    input,
  );
  assert.deepEqual(response.proposals, []);
});

test("a later question stays singular and attached to an actual answered story", () => {
  const input = stories("Making a bowl.");
  assert.deepEqual(
    validatedOnboardingInsights(
      {
        follow_up: { story_index: 0, question: "What about it pulled you in?" },
      },
      input,
    ).follow_up,
    { story_index: 0, question: "What about it pulled you in?" },
  );
  for (const follow_up of [
    { story_index: 0, question: "Who was there? What did you learn?" },
    { story_index: 1, question: "What did you love?" },
    { story_index: -1, question: "Why?" },
  ])
    assert.equal(
      validatedOnboardingInsights({ follow_up }, input).follow_up,
      null,
    );
});

test("dismissal identity is stable but a changed evidence quote is a new proposal", () => {
  const original = storyProposals(stories("I was drawing birds."))[0];
  assert.equal(proposalKey(original), proposalKey({ ...original }));
  assert.notEqual(
    proposalKey(original),
    proposalKey({
      ...original,
      evidence: [{ story_index: 0, quote: "I loved drawing faces." }],
    }),
  );
});
