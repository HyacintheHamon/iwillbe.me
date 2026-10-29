import assert from "node:assert/strict";
import test from "node:test";
import {
  validateReflectionProposal,
  validateWeeklyFocus,
} from "../supabase/functions/chloe/proposals";

const intention = { id: "today", interest: "Cooking", value: "Patience" };
const words =
  "I did it. Cooking lit me up. I'll let patience go; courage feels more like me.";
const sources = new Map([["me", words]]);
const raw = () => ({
  intention_id: "today",
  outcome: "yes",
  energy: "lit",
  value_choice: "not_mine",
  replacement_value: "courage",
  reflection: "An invented interpretation",
  evidence: [
    { field: "outcome", source_id: "me", quote: "I did it." },
    { field: "energy", source_id: "me", quote: "Cooking lit me up." },
    { field: "value_choice", source_id: "me", quote: "I'll let patience go" },
    {
      field: "replacement_value",
      source_id: "me",
      quote: "courage feels more like me",
    },
    { field: "reflection", source_id: "me", quote: "Cooking lit me up." },
  ],
});
test("a night proposal preserves distinct sourced choices and the person's actual words", () => {
  const result = validateReflectionProposal(
    raw(),
    "night",
    intention,
    sources,
  )!;
  assert.equal(result.outcome, "yes");
  assert.equal(result.energy, "lit");
  assert.equal(result.value_choice, "not_mine");
  assert.equal(result.replacement_value, "courage");
  assert.equal(result.reflection, "Cooking lit me up.");
});
test("missing outcome cannot be inferred from energy and fabricated quotations are rejected", () => {
  const input = raw();
  input.evidence = [
    { field: "energy", source_id: "me", quote: "Cooking lit me up." },
    { field: "outcome", source_id: "me", quote: "I completed everything." },
  ];
  const result = validateReflectionProposal(
    input,
    "night",
    intention,
    sources,
  )!;
  assert.equal(result.outcome, null);
  assert.equal(result.energy, "lit");
  assert.equal(result.value_choice, null);
  assert.equal(result.reflection, "");
});
test("past intentions, other modes, assistant/old sources and absent commitments never create check-ins", () => {
  assert.equal(
    validateReflectionProposal(raw(), "morning", intention, sources),
    null,
  );
  assert.equal(validateReflectionProposal(raw(), "night", null, sources), null);
  assert.equal(
    validateReflectionProposal(
      { ...raw(), intention_id: "yesterday" },
      "night",
      intention,
      sources,
    ),
    null,
  );
  assert.equal(
    validateReflectionProposal(raw(), "night", intention, new Map()),
    null,
  );
});
test("not doing a commitment clears energy/value decisions, and activities without values stay separate", () => {
  const missed = raw();
  missed.outcome = "not_yet";
  missed.evidence[0].quote = "I did not do it.";
  const skipped = validateReflectionProposal(
    missed,
    "night",
    intention,
    new Map([["me", `${words} I did not do it.`]]),
  )!;
  assert.equal(skipped.energy, null);
  assert.equal(skipped.value_choice, null);
  assert.equal(skipped.replacement_value, null);
  const activity = validateReflectionProposal(
    raw(),
    "night",
    { ...intention, value: "" },
    sources,
  )!;
  assert.equal(activity.value_choice, null);
  assert.equal(activity.replacement_value, null);
});

test("exact words cannot be relabeled as a completion or have their negation removed", () => {
  for (const [source, quote] of [
    ["Cooking lit me up.", "Cooking lit me up."],
    ["I did not do it.", "I did not do it."],
    ["I never said I did it.", "I did it"],
    ["I did it?", "I did it"],
    ["I only did part of it.", "I only did part of it."],
    ["Yes.", "Yes."],
    ["Oui, je l’ai fait.", "Oui, je l’ai fait."],
  ]) {
    const result = validateReflectionProposal(
      {
        ...raw(),
        evidence: [{ field: "outcome", source_id: "me", quote }],
      },
      "night",
      intention,
      new Map([["me", source]]),
    );
    assert.equal(result?.outcome ?? null, null, source);
  }
});

test("past and future sentences do not become today's choices or reflection", () => {
  for (const source of [
    "Yesterday I did it.",
    "Last night I did it.",
    "Last week was busy. I did it.",
    "Tomorrow is a fresh start. I did it.",
  ]) {
    const quote = source.endsWith("I did it.") ? "I did it." : source;
    assert.equal(
      validateReflectionProposal(
        {
          ...raw(),
          evidence: [
            { field: "outcome", source_id: "me", quote },
            { field: "reflection", source_id: "me", quote },
          ],
        },
        "night",
        intention,
        new Map([["me", source]]),
      ),
      null,
      source,
    );
  }
  const source = "Yesterday I did not do it. Today I did it.";
  const result = validateReflectionProposal(
    {
      ...raw(),
      evidence: [
        { field: "outcome", source_id: "me", quote: "Today I did it." },
      ],
    },
    "night",
    intention,
    new Map([["me", source]]),
  );
  assert.equal(result?.outcome, "yes");
});

test("clear completion, partial completion and absence stay different", () => {
  for (const [quote, outcome] of [
    ["I did it.", "yes"],
    ["I made a small step.", "partly"],
    ["I started but didn't finish.", "partly"],
    ["I did not do it.", "not_yet"],
  ]) {
    assert.equal(
      validateReflectionProposal(
        {
          ...raw(),
          outcome,
          evidence: [{ field: "outcome", source_id: "me", quote }],
        },
        "night",
        intention,
        new Map([["me", quote]]),
      )?.outcome,
      outcome,
    );
  }
  const quote = "I didn't finish.";
  assert.equal(
    validateReflectionProposal(
      {
        ...raw(),
        outcome: "not_yet",
        evidence: [{ field: "outcome", source_id: "me", quote }],
      },
      "night",
      intention,
      new Map([["me", quote]]),
    ),
    null,
  );
});

test("a directly described action must match today's commitment", () => {
  const quote = "I called my aunt.";
  const proposal = {
    ...raw(),
    evidence: [{ field: "outcome", source_id: "me", quote }],
  };
  assert.equal(
    validateReflectionProposal(
      proposal,
      "night",
      { ...intention, action: "Call my aunt" },
      new Map([["me", quote]]),
    )?.outcome,
    "yes",
  );
  assert.equal(
    validateReflectionProposal(
      proposal,
      "night",
      { ...intention, action: "Cook dinner" },
      new Map([["me", quote]]),
    ),
    null,
  );
  assert.equal(
    validateReflectionProposal(
      proposal,
      "night",
      { ...intention, action: "Call my doctor" },
      new Map([["me", quote]]),
    ),
    null,
  );
});

test("energy and value choices require their own unambiguous current words", () => {
  for (const [field, chosen, source, quote] of [
    ["energy", "lit", "It never lit me up.", "lit me up"],
    ["energy", "drained", "I did not feel drained.", "drained"],
    ["energy", "lit", "I did it.", "I did it."],
    ["energy", "lit", "It lit me up but left me drained.", "It lit me up"],
    [
      "energy",
      "drained",
      "It lit me up but left me drained.",
      "left me drained",
    ],
    ["value_choice", "yes", "Patience is not mine.", "Patience is not mine."],
    [
      "value_choice",
      "not_mine",
      "I don't want to let patience go.",
      "let patience go",
    ],
    ["value_choice", "yes", "Keep it.", "Keep it."],
    ["value_choice", "yes", "Yesterday I chose patience.", "I chose patience"],
    [
      "value_choice",
      "yes",
      "I choose courage over patience.",
      "I choose courage over patience.",
    ],
    [
      "value_choice",
      "not_mine",
      "I let my expectations go and choose patience.",
      "I let my expectations go and choose patience.",
    ],
  ]) {
    const result = validateReflectionProposal(
      {
        ...raw(),
        [field]: chosen,
        evidence: [{ field, source_id: "me", quote }],
      },
      "night",
      intention,
      new Map([["me", source]]),
    );
    assert.equal(
      result?.[field as "energy" | "value_choice"] ?? null,
      null,
      source,
    );
  }
  for (const [quote, value_choice] of [
    ["I choose patience again.", "yes"],
    ["I'm still deciding about patience.", "not_sure"],
    ["Patience isn't mine.", "not_mine"],
  ]) {
    assert.equal(
      validateReflectionProposal(
        {
          ...raw(),
          value_choice,
          evidence: [{ field: "value_choice", source_id: "me", quote }],
        },
        "night",
        intention,
        new Map([["me", quote]]),
      )?.value_choice,
      value_choice,
    );
  }
});

test("replacement names need an affirmative choice, not a substring or a rejected alternative", () => {
  for (const quote of [
    "I feel discouraged.",
    "I don't choose courage.",
    "Patience matters more than courage.",
  ]) {
    const input = raw();
    input.evidence = [
      { field: "value_choice", source_id: "me", quote: "I'll let patience go" },
      { field: "replacement_value", source_id: "new", quote },
    ];
    assert.equal(
      validateReflectionProposal(
        input,
        "night",
        intention,
        new Map([...sources, ["new", quote]]),
      )?.replacement_value,
      null,
    );
  }
});
test("replacement values need the person's exact named value, never an invented alternative", () => {
  assert.equal(
    validateReflectionProposal(
      { ...raw(), replacement_value: "kindness" },
      "night",
      intention,
      sources,
    )?.replacement_value,
    null,
  );
});
test("weekly focus needs evidence and respects a fixed area", () => {
  const proposal = {
    area: "Grow",
    reason: "You enjoyed teaching your niece.",
    source_ids: ["source"],
  };
  assert.deepEqual(
    validateWeeklyFocus(proposal, "sunday", new Set(["source"]), null),
    proposal,
  );
  assert.equal(
    validateWeeklyFocus(proposal, "night", new Set(["source"]), null),
    null,
  );
  assert.equal(validateWeeklyFocus(proposal, "sunday", new Set(), null), null);
  assert.equal(
    validateWeeklyFocus(proposal, "sunday", new Set(["source"]), {
      pace: "stay",
      orbit: "People",
    }),
    null,
  );
});
