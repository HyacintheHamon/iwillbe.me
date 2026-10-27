import assert from "node:assert/strict";
import test from "node:test";
import {
  constrainChloeReply as constrain,
  schemaForProposalCapability,
  legacyProposalInstruction,
  type ChloeAnswer,
} from "../supabase/functions/chloe/reply";
import { resolveResponseQuestion } from "../supabase/functions/chloe/prompt";
const constrainChloeReply = (answer: ChloeAnswer) =>
  constrain(answer, resolveResponseQuestion, true);

const cards = [
  "reflection_proposal",
  "suggested_intention",
  "why_proposal",
  "discovery",
  "weekly_focus",
  "memory_suggestion",
] as const;

test("only the highest priority validated proposal remains actionable", () => {
  for (let first = 0; first < cards.length; first++) {
    const offered = Object.fromEntries(
      cards.map((key, index) => [key, index >= first ? { title: key } : null]),
    );
    const result = constrainChloeReply({
      message: "Keep what feels true.",
      question: null,
      ...offered,
    });
    for (const key of cards)
      assert.equal(
        !!result[key],
        key === cards[first],
        `${cards[first]} / ${key}`,
      );
  }
});

test("a reflection review replaces further questions with one short off-screen close", () => {
  const result = constrainChloeReply({
    message: "Did it light you up? What else did you notice?",
    question: "Did it light you up?",
    reflection_proposal: { intention_id: "today" },
    discovery: { title: "Cooking" },
  });
  assert.equal(result.question, null);
  assert.doesNotMatch(result.message, /\?/);
  assert.match(result.message, /ready to review/);
  assert.equal(result.discovery, null);
  assert(result.reflection_proposal);
});

test("a brief meaningful close survives a reflection card unchanged", () => {
  const message =
    "The quiet you found with clay stayed with you. Let the night be yours.";
  const result = constrainChloeReply({
    message,
    reflection_proposal: { intention_id: "today" },
  });
  assert.equal(result.message, message);
  assert.equal(result.question, null);
});

test("the visible message contains at most the first actual question even if the model supplied another", () => {
  for (const question of [null, "What lit you up?", "Who was there?"]) {
    const result = constrainChloeReply({
      message:
        "A little room to notice. What lit you up? Who was there? Tell me everything.",
      question,
    });
    assert.equal(result.message, "A little room to notice. What lit you up?");
    assert.equal(result.question, "What lit you up?");
  }
});

test("quote closings and non-question replies remain intact; absent old API fields are explicit nulls", () => {
  const quoted = constrainChloeReply({
    message: "You might carry this: “What lit you up?” Who was there?",
    question: null,
  });
  assert.equal(quoted.message, "You might carry this: “What lit you up?”");
  assert.equal(quoted.question, "You might carry this: “What lit you up?”");
  const legacy = constrainChloeReply({
    message: "You can leave it here tonight.",
  });
  assert.equal(legacy.message, "You can leave it here tonight.");
  assert.equal(legacy.question, null);
  for (const key of cards) assert.equal(legacy[key], null);
});

test("legacy clients request null card fields while retaining their existing suggestion schema", () => {
  const schema = {
    type: "object",
    properties: {
      message: { type: "string" },
      reflection_proposal: { type: "object" },
      weekly_focus: { type: "object" },
      discovery: { type: "object" },
    },
  };
  const legacy = schemaForProposalCapability(schema, false);
  assert.deepEqual(legacy.properties.reflection_proposal, { type: "null" });
  assert.deepEqual(legacy.properties.weekly_focus, { type: "null" });
  assert.deepEqual(legacy.properties.discovery, schema.properties.discovery);
  assert.equal(schemaForProposalCapability(schema, true), schema);
  assert.match(legacyProposalInstruction, /ask one short unanswered question/);
  assert.match(legacyProposalInstruction, /Do not claim to save/);
});

test("legacy responses preserve a useful question and never refer to an invisible review card", () => {
  const answer = {
    message: "What did choosing patience make possible?",
    question: "What did choosing patience make possible?",
    reflection_proposal: { outcome: "yes" },
    weekly_focus: { area: "Be" },
  };
  const legacy = constrain(answer, resolveResponseQuestion, false);
  assert.equal(legacy.message, answer.message);
  assert.equal(legacy.question, answer.question);
  assert.equal(legacy.reflection_proposal, null);
  assert.equal(legacy.weekly_focus, null);
  const orphan = constrain(
    {
      ...answer,
      message: "Your words are ready to review. See the card below.",
    },
    resolveResponseQuestion,
  );
  assert.doesNotMatch(orphan.message, /review|card|ready to save/i);
  assert.equal(orphan.question, null);
});
