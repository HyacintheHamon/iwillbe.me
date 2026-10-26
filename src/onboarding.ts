export const FIRST_SESSION_STORIES = [
  "When did time disappear on you recently?",
  "What did you love doing as a kid?",
  "Who do you admire, and why?",
] as const;
export const GROWTH_QUESTION =
  "Is there something you'd like to get better at?";
export const WHY_QUESTION = "Who do you want to be remembered as?";
export const MORNING_ANCHOR_QUESTION =
  "What do you usually do right before your day starts?";
export const EVENING_ANCHOR_QUESTION =
  "What do you usually do right before you end your day?";

// An unfinished answer is an open question, never a person's why or an interest.
export function isUnreadyAnswer(answer: string) {
  const text = answer.trim().toLowerCase().replace(/[’]/g, "'");
  return (
    !text ||
    /^(?:i\s+|i'm\s+)?(?:don'?t know(?: yet)?|do not know(?: yet)?|am not sure(?: yet)?|not sure(?: yet)?|don't know what to say|do not know what to say|have no idea|no idea|idk|still forming|not ready(?: yet)?)[.!?\s]*$/.test(
      text,
    )
  );
}
export function firstSessionStep(version: number, step: number) {
  if (version === 2) return Math.max(0, Math.min(step, 13));
  // Retain the unfinished v1 quick picks and stories; retire the score screen.
  return [0, 1, 3, 6, 8][step] ?? 0;
}
export function quickPickState(choice: string) {
  return choice === "love" ? "love" : choice === "curious" ? "spark" : null;
}
export function validCheckInTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function pickObservation(picks: { title: string; choice: string }[]) {
  const loved = picks.find((pick) => pick.choice === "love");
  const curious = picks.find((pick) => pick.choice === "curious");
  if (loved && curious)
    return `${loved.title} already has a place in your life. ${curious.title} is something you might explore.`;
  if (loved) return `${loved.title} already has a place in your life.`;
  if (curious)
    return `${curious.title} caught your curiosity. That's enough to begin.`;
  return "Nothing needs to click just yet. Your stories can give us another way in.";
}
export function suggestedFirstValue(stories: string[], hasCuriosity: boolean) {
  const text = stories.join(" ").toLowerCase();
  const explicit = [
    ["Patience", /\b(?:patience|patient)\b/],
    ["Kindness", /\b(?:kindness|kind)\b/],
    ["Courage", /\b(?:courage|brave)\b/],
    ["Fairness", /\b(?:fairness|fair)\b/],
    ["Honesty", /\b(?:honesty|honest)\b/],
    ["Creativity", /\b(?:creativity|creative)\b/],
    ["Curiosity", /\b(?:curiosity|curious)\b/],
  ] as const;
  // Only an invitation to try a value, never a claim or an automatic save.
  return (
    explicit.find(([, pattern]) => pattern.test(text))?.[0] ||
    (hasCuriosity ? "Curiosity" : null)
  );
}
