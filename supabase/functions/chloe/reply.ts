const cardPriority = [
  "reflection_proposal",
  "suggested_intention",
  "why_proposal",
  "discovery",
  "weekly_focus",
  "memory_suggestion",
] as const;
type CardKey = (typeof cardPriority)[number];
export type ChloeAnswer = {
  message: string;
  question?: unknown;
} & Partial<Record<CardKey, unknown>>;

export const legacyProposalInstruction = `\n\nCLIENT CAPABILITY: This client cannot display reflection review cards or weekly-focus confirmation cards. reflection_proposal and weekly_focus MUST be null. Keep the conversation usable in message: ask one short unanswered question at a time about today's actual commitment, energy or value, then close briefly when there is enough. Do not refer to a review card, confirmation button, or ready-to-save draft the client cannot show. Do not claim to save a check-in or weekly focus. Existing intention, discovery, why and memory suggestions are supported, one at a time. This capability instruction overrides the card-specific instructions above.`;

export function schemaForProposalCapability(
  schema: { properties: Record<string, unknown>; [key: string]: unknown },
  proposalCards: boolean,
) {
  return proposalCards
    ? schema
    : {
        ...schema,
        properties: {
          ...schema.properties,
          reflection_proposal: { type: "null" },
          weekly_focus: { type: "null" },
        },
      };
}

export function constrainChloeReply(
  answer: ChloeAnswer,
  resolveQuestion: (proposed: unknown, message: string) => string | null,
  proposalCards = false,
) {
  const result: { message: string; question: string | null } & Record<
    CardKey,
    unknown
  > = {
    ...answer,
    question: typeof answer.question === "string" ? answer.question : null,
    reflection_proposal: answer.reflection_proposal ?? null,
    suggested_intention: answer.suggested_intention ?? null,
    why_proposal: answer.why_proposal ?? null,
    discovery: answer.discovery ?? null,
    weekly_focus: answer.weekly_focus ?? null,
    memory_suggestion: answer.memory_suggestion ?? null,
  };
  if (!proposalCards) {
    result.reflection_proposal = null;
    result.weekly_focus = null;
    if (
      (answer.reflection_proposal || answer.weekly_focus) &&
      /\b(?:review card|ready to review|ready to save|confirm(?:ation)? button|review below|card below)\b/i.test(
        result.message,
      )
    )
      result.message =
        "Your words can stay here. Let the rest of the day be yours.";
  }
  const chosen = cardPriority.find((key) => !!result[key]);
  for (const key of cardPriority) {
    if (key !== chosen) result[key] = null;
  }
  if (chosen === "reflection_proposal") {
    if (/[?？؟]/u.test(result.message))
      result.message =
        "Your words are ready to review. Keep what feels true, then let the night be yours.";
    result.question = null;
    return result;
  }
  // Keep the first real question and any brief lead-in. A supplied question
  // field must never hide a second question still present in the visible reply.
  const firstQuestion = result.message.search(/[?？؟]/u);
  if (firstQuestion >= 0) {
    const closing =
      result.message.slice(firstQuestion + 1).match(/^["'”’)\]]*/u)?.[0] || "";
    result.message = result.message
      .slice(0, firstQuestion + 1 + closing.length)
      .trim();
  }
  result.question = resolveQuestion(result.question, result.message);
  return result;
}
