// Pure contracts: keep model output untrusted until its sources have been checked.
export type ReflectionProposal = {
  intention_id: string;
  outcome: "yes" | "partly" | "not_yet" | null;
  energy: "lit" | "neutral" | "drained" | null;
  value_choice: "yes" | "not_sure" | "not_mine" | null;
  replacement_value: string | null;
  reflection: string;
  evidence: {
    field:
      | "outcome"
      | "energy"
      | "value_choice"
      | "replacement_value"
      | "reflection";
    source_id: string;
    quote: string;
  }[];
};
export type WeeklyFocusProposal = {
  area: "Be" | "People" | "Causes" | "Passions" | "Grow";
  reason: string;
  source_ids: string[];
};
const nullable = (value: object) => ({ anyOf: [{ type: "null" }, value] });
export const reflectionProposalSchema = nullable({
  type: "object",
  additionalProperties: false,
  required: [
    "intention_id",
    "outcome",
    "energy",
    "value_choice",
    "replacement_value",
    "reflection",
    "evidence",
  ],
  properties: {
    intention_id: { type: "string" },
    outcome: nullable({ type: "string", enum: ["yes", "partly", "not_yet"] }),
    energy: nullable({ type: "string", enum: ["lit", "neutral", "drained"] }),
    value_choice: nullable({
      type: "string",
      enum: ["yes", "not_sure", "not_mine"],
    }),
    replacement_value: nullable({ type: "string" }),
    reflection: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "source_id", "quote"],
        properties: {
          field: {
            type: "string",
            enum: [
              "outcome",
              "energy",
              "value_choice",
              "replacement_value",
              "reflection",
            ],
          },
          source_id: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
});
export const weeklyFocusSchema = nullable({
  type: "object",
  additionalProperties: false,
  required: ["area", "reason", "source_ids"],
  properties: {
    area: {
      type: "string",
      enum: ["Be", "People", "Causes", "Passions", "Grow"],
    },
    reason: { type: "string" },
    source_ids: { type: "array", items: { type: "string" } },
  },
});
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const plain = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const escapePattern = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pastTime =
  /\b(?:yesterday|last (?:night|week|month|year|time|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|the other day|earlier (?:this|in the) (?:week|month|year)|\w+ (?:days?|weeks?|months?|years?) ago|used to|when i was|as a (?:child|kid)|hier|anoche|ayer|gestern)\b/i;
const futureTime =
  /\b(?:tomorrow|next (?:week|month|year|time|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|someday|one day|in the future|demain|mañana|morgen)\b/i;
const currentTime =
  /\b(?:today|tonight|this (?:morning|afternoon|evening)|just now)\b/i;
const temporalMarker =
  /\b(?:today|tonight|this (?:morning|afternoon|evening)|just now|yesterday|last (?:night|week|month|year|time)|tomorrow|next (?:week|month|year|time)|hier|anoche|ayer|gestern|demain|mañana|morgen)\b/gi;
const negated =
  /\b(?:not|never|no|cannot|can't|don't|doesn't|didn't|haven't|hasn't|hadn't|wasn't|weren't|isn't|aren't|won't|wouldn't|couldn't)\b/i;
const uncertain =
  /\b(?:if|wish|maybe|perhaps|probably|might|could have|would have|hope|not sure|don't know|do not know|can't remember)\b/i;
const reported =
  /\b(?:said|says|told|quoted|asked|pretend|imagine|example|untrue|false|deny|denied)\b|\bwrote\s+(?:that\b|["'])|\b(?:not true|didn't mean|did not mean|don't mean|do not mean)\b/i;

// A literal substring is not enough: retain the whole source sentence around it
// so omitted negation, a different actor, and a preceding date remain visible.
// Ambiguous repeated occurrences are rejected instead of choosing a convenient one.
function sourceContexts(source: string, quote: string) {
  const contexts: { text: string; prefix: string }[] = [];
  let cursor = 0;
  for (;;) {
    const at = source.indexOf(quote, cursor);
    if (at < 0) break;
    const prefix = source.slice(0, at);
    const boundaries = [...prefix.matchAll(/[.!?;\n]/g)];
    const start = boundaries.length
      ? boundaries[boundaries.length - 1].index! + 1
      : 0;
    const tail = source.slice(at + quote.length);
    const boundary = tail.search(/[.!?;\n]/);
    const end = /[.!?;\n]["'”’)\]]*\s*$/.test(quote)
      ? at + quote.length
      : boundary < 0
        ? source.length
        : at + quote.length + boundary + 1;
    contexts.push({
      text: source.slice(start, end).trim(),
      prefix: source.slice(0, start),
    });
    cursor = at + Math.max(quote.length, 1);
  }
  return contexts;
}
function currentContext(context: { text: string; prefix: string }) {
  if (pastTime.test(context.text) || futureTime.test(context.text))
    return false;
  if (currentTime.test(context.text)) return true;
  const markers = [...context.prefix.matchAll(temporalMarker)];
  const inherited = markers[markers.length - 1]?.[0];
  return !inherited || currentTime.test(inherited);
}
function trustworthyChoiceContext(text: string) {
  return !reported.test(text) && !/[?？؟]/u.test(text);
}
const actionVerbs: Record<string, string[]> = {
  call: ["called"],
  write: ["wrote", "written"],
  read: ["read"],
  walk: ["walked"],
  run: ["ran"],
  paint: ["painted"],
  draw: ["drew", "drawn"],
  cook: ["cooked"],
  practice: ["practiced", "practised"],
  practise: ["practised", "practiced"],
  spend: ["spent"],
  give: ["gave", "given"],
  help: ["helped"],
  visit: ["visited"],
  listen: ["listened"],
  make: ["made"],
  repair: ["repaired"],
  go: ["went", "gone"],
  hike: ["hiked"],
  swim: ["swam"],
  volunteer: ["volunteered"],
  study: ["studied"],
  learn: ["learned", "learnt"],
  meditate: ["meditated"],
  play: ["played"],
};
function explicitAction(quote: string, action: unknown) {
  if (typeof action !== "string") return false;
  const words =
    plain(action)
      .replace(/^i will (?:be )?/, "")
      .match(/[\p{L}\p{N}']+/gu) || [];
  const verb = words[0] || "";
  const forms = Object.hasOwn(actionVerbs, verb)
    ? actionVerbs[verb]
    : undefined;
  const targets = words
    .slice(1)
    .filter(
      (word) =>
        ![
          "a",
          "an",
          "the",
          "my",
          "our",
          "to",
          "for",
          "with",
          "at",
          "in",
          "on",
          "of",
          "some",
        ].includes(word),
    );
  return (
    !!forms &&
    targets.every((word) =>
      new RegExp(`\\b${escapePattern(word)}\\b`).test(quote),
    ) &&
    new RegExp(
      `\\b(?:i|we) (?:actually |finally |have )?(?:${forms.join("|")})\\b`,
    ).test(quote)
  );
}
function outcomeMeaning(quote: string, context: string, action: unknown) {
  const q = plain(quote),
    c = plain(context);
  if (!trustworthyChoiceContext(c) || uncertain.test(c)) return null;
  if (
    (/\b(?:i|we) (?:did not|didn't|have not|haven't|could not|couldn't|never) (?:(?:do|done) (?:it|that|my commitment|our commitment|the commitment)|start|show up|follow through|get to it)\b/.test(
      q,
    ) &&
      !/\b(?:all|everything|whole|fully|completely|partly|halfway|some of|part of)\b/.test(
        c,
      )) ||
    /^not this time[.!]?$/.test(q)
  )
    return "not_yet";
  const partial =
    /\b(?:i|we) (?:did (?:only )?(?:part|some) of|got (?:only )?halfway|made (?:a )?(?:small step|start)|started (?:it )?but (?:did not|didn't) finish)\b/.test(
      q,
    ) || /^a small step[.!]?$/.test(q);
  if (
    partial &&
    !negated.test(c.replace(/(?:did not|didn't) finish\b/g, "finish"))
  )
    return "partly";
  if (
    negated.test(c) ||
    /\b(?:only|partly|partially|halfway|some of|part of|started but)\b/.test(c)
  )
    return null;
  if (
    /\b(?:i|we) (?:actually |finally )?(?:did (?:it|that)|showed up|followed through|finished|completed)\b/.test(
      q,
    ) ||
    explicitAction(q, action)
  )
    return "yes";
  return null;
}
function energyMeaning(quote: string, context: string) {
  const q = plain(quote),
    c = plain(context);
  if (!trustworthyChoiceContext(c) || uncertain.test(c) || negated.test(c))
    return null;
  const mixed = [
    /\b(?:lit me up|energized|energised|energizing|energising|enjoyed|loved|alive)\b/,
    /\bneutral\b/,
    /\b(?:drained|exhausted|depleted)\b/,
  ].filter((meaning) => meaning.test(c));
  if (mixed.length > 1) return null;
  if (
    /\b(?:lit me up|energized me|energised me|i felt (?:energized|energised|alive)|i (?:really )?(?:enjoyed|loved) (?:it|that|the|cooking|painting)|(?:it|that) (?:was|felt) energizing|(?:it|that) (?:was|felt) energising)\b/.test(
      q,
    )
  )
    return "lit";
  if (
    /\b(?:felt neutral|left me (?:feeling )?neutral|was neutral)\b/.test(q) ||
    /^neutral[.!]?$/.test(q)
  )
    return "neutral";
  if (
    /\b(?:drained me|left me (?:feeling )?(?:drained|exhausted|depleted)|i felt (?:drained|exhausted|depleted))\b/.test(
      q,
    ) ||
    /^drained[.!]?$/.test(q)
  )
    return "drained";
  return null;
}
function valueMeaning(quote: string, context: string, value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const q = plain(quote),
    c = plain(context),
    name = escapePattern(plain(value));
  if (!trustworthyChoiceContext(c) || !new RegExp(`\\b${name}\\b`).test(q))
    return null;
  const self = /\b(?:i|we|me|mine|us|ours)\b/.test(q);
  if (!self) return null;
  if (
    /\b(?:not sure|undecided|still deciding)\b/.test(q) &&
    !/\bnot (?:undecided|still deciding)\b/.test(c)
  )
    return "not_sure";
  if (
    new RegExp(`\\b${name} (?:is not|isn't) (?:mine|for me)\\b`).test(q) &&
    !/\b(?:don't|do not|didn't|did not) (?:say|think|mean)\b/.test(c)
  )
    return "not_mine";
  if (negated.test(c) || uncertain.test(c)) return null;
  if (
    new RegExp(
      `\\b(?:let ${name} go|let go of ${name}|release ${name}|leave ${name} behind|stop choosing ${name})\\b`,
    ).test(q) ||
    new RegExp(
      `\\b(?:prefer|choose)\\b.{1,80}\\b(?:to|over|instead of|rather than) ${name}\\b`,
    ).test(q)
  )
    return "not_mine";
  if (
    new RegExp(`\\b(?:choose|keep|keeping) ${name}\\b`).test(q) ||
    new RegExp(`\\b${name} is mine\\b`).test(q)
  )
    return "yes";
  return null;
}
function replacementMeaning(
  quote: string,
  context: string,
  replacement: unknown,
  currentValue: unknown,
) {
  if (
    typeof replacement !== "string" ||
    !replacement.trim() ||
    replacement.length > 80
  )
    return false;
  const name = plain(replacement),
    q = plain(quote),
    c = plain(context);
  if (typeof currentValue === "string" && name === plain(currentValue))
    return false;
  if (!trustworthyChoiceContext(c) || negated.test(c) || uncertain.test(c))
    return false;
  const escaped = escapePattern(name);
  return (
    new RegExp(
      `\\b${escaped} (?:feels more like me|matters more(?: to me)?|is the value i (?:choose|want))\\b`,
    ).test(q) ||
    new RegExp(
      `\\b(?:i|we) (?:choose|prefer|want to try|want to choose|will try) ${escaped}\\b`,
    ).test(q)
  );
}

export function validateReflectionProposal(
  raw: unknown,
  mode: string,
  intention: {
    id: string;
    interest?: unknown;
    value?: unknown;
    action?: unknown;
  } | null,
  userSources: Map<string, string>,
): ReflectionProposal | null {
  if (
    mode !== "night" ||
    !intention ||
    !record(raw) ||
    raw.intention_id !== intention.id ||
    !Array.isArray(raw.evidence)
  )
    return null;
  const fields = [
    "outcome",
    "energy",
    "value_choice",
    "replacement_value",
    "reflection",
  ];
  const evidence = raw.evidence
    .filter(
      (item): item is ReflectionProposal["evidence"][number] =>
        record(item) &&
        fields.includes(String(item.field)) &&
        typeof item.source_id === "string" &&
        typeof item.quote === "string" &&
        item.quote.trim().length > 0 &&
        item.quote.length <= 2000 &&
        !!userSources.get(item.source_id)?.includes(item.quote),
    )
    .filter((piece) => {
      const contexts = sourceContexts(
        userSources.get(piece.source_id)!,
        piece.quote,
      );
      return (
        contexts.length > 0 &&
        contexts.every((context) => {
          if (!currentContext(context)) return false;
          if (piece.field === "reflection") return true;
          if (piece.field === "outcome")
            return (
              typeof raw.outcome === "string" &&
              outcomeMeaning(piece.quote, context.text, intention.action) ===
                raw.outcome
            );
          if (piece.field === "energy")
            return (
              typeof raw.energy === "string" &&
              energyMeaning(piece.quote, context.text) === raw.energy
            );
          if (piece.field === "value_choice")
            return (
              typeof raw.value_choice === "string" &&
              valueMeaning(piece.quote, context.text, intention.value) ===
                raw.value_choice
            );
          return replacementMeaning(
            piece.quote,
            context.text,
            raw.replacement_value,
            intention.value,
          );
        })
      );
    })
    .slice(0, 10);
  const supported = (field: string) => evidence.some((e) => e.field === field);
  const outcome =
    supported("outcome") &&
    ["yes", "partly", "not_yet"].includes(String(raw.outcome))
      ? (raw.outcome as ReflectionProposal["outcome"])
      : null;
  const energy =
    outcome !== "not_yet" &&
    !!intention.interest &&
    supported("energy") &&
    ["lit", "neutral", "drained"].includes(String(raw.energy))
      ? (raw.energy as ReflectionProposal["energy"])
      : null;
  const value_choice =
    outcome !== "not_yet" &&
    !!intention.value &&
    supported("value_choice") &&
    ["yes", "not_sure", "not_mine"].includes(String(raw.value_choice))
      ? (raw.value_choice as ReflectionProposal["value_choice"])
      : null;
  const replacement_value =
    value_choice === "not_mine" &&
    typeof raw.replacement_value === "string" &&
    raw.replacement_value.trim().length > 0 &&
    raw.replacement_value.length <= 80 &&
    supported("replacement_value")
      ? raw.replacement_value.trim()
      : null;
  // Keep the person's words, never an invented summary of their day.
  const reflection = evidence
    .filter((e) => e.field === "reflection")
    .map((e) => e.quote)
    .filter((quote, index, all) => all.indexOf(quote) === index)
    .join("\n\n")
    .slice(0, 2000);
  if (!outcome && !energy && !value_choice && !reflection) return null;
  return {
    intention_id: intention.id,
    outcome,
    energy,
    value_choice,
    replacement_value,
    reflection,
    evidence,
  };
}

export function validateWeeklyFocus(
  raw: unknown,
  mode: string,
  evidenceIds: Set<string>,
  focus: { pace?: unknown; orbit?: unknown } | null,
): WeeklyFocusProposal | null {
  if (
    !["sunday", "explore"].includes(mode) ||
    !record(raw) ||
    !["Be", "People", "Causes", "Passions", "Grow"].includes(
      String(raw.area),
    ) ||
    typeof raw.reason !== "string" ||
    !raw.reason.trim() ||
    raw.reason.length > 500 ||
    !Array.isArray(raw.source_ids) ||
    !raw.source_ids.length ||
    raw.source_ids.some(
      (id) => typeof id !== "string" || !evidenceIds.has(id),
    ) ||
    (focus?.pace === "stay" && focus.orbit !== raw.area)
  )
    return null;
  return {
    area: raw.area as WeeklyFocusProposal["area"],
    reason: raw.reason.trim(),
    source_ids: [...new Set(raw.source_ids)] as string[],
  };
}
