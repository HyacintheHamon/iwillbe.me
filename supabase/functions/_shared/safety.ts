// A conservative fallback, not a diagnosis. Model classification supplements it.
// Ordinary tiredness, figurative language and explicit negations do not trigger it.
export function supportLevel(message: string): number {
  const text = message.toLowerCase().replace(/[’]/g, "'");
  const unnegated = text.replace(
    /\b(?:i am not|i'm not|not feeling|don't feel) (?:suicidal|in danger|unsafe)\b/g,
    "",
  );
  if (
    /\b(?:i (?:want|plan|intend) to (?:kill|hurt) myself|i(?:'m| am) going to (?:kill|hurt) myself|i (?:want|plan) to kill (?:someone|him|her|them)|i don'?t want to (?:be alive|live anymore)|i am in immediate danger|someone is hurting me)\b/.test(
      unnegated,
    )
  )
    return 3;
  if (
    /\b(?:i (?:feel|have felt|have been feeling) (?:low|empty|anxious|hopeless) (?:every day|most days|for weeks)|i (?:can't|cannot) (?:get out of bed|stop drinking)|i (?:feel|am) unsafe (?:at home|with my partner))\b/.test(
      unnegated,
    )
  )
    return 2;
  return 0;
}
export const SUPPORT_REPLY =
  "Thank you for telling me. You deserve support from a real person. Is there someone you trust you can reach out to right now?";
