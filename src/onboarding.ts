import { firstAffirmativeValue } from "./onboarding-insights";
import type { Practice } from "./domain";
import { dayInZone, questionAvailable } from "./journey";

export function firstSessionQuestionAvailable(
  practice: Practice,
  question: string,
  now = new Date(),
) {
  return questionAvailable(
    practice,
    question,
    dayInZone(practice.profile.timezone, now),
    "first-session",
  );
}

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
  if (version === 3) return Math.max(0, Math.min(step, 13));
  // The observation now sits beside the first story. Clock times are optional
  // after the two anchors, so an older draft keeps moving without losing text.
  if (version === 2)
    return (
      ({ 2: 3, 10: 11, 12: 13 } as Record<number, number>)[step] ??
      Math.max(0, Math.min(step, 13))
    );
  // Retain the unfinished v1 quick picks and stories; retire the score screen.
  return [0, 1, 3, 6, 8][step] ?? 0;
}
export function previousFirstSessionStep(step: number) {
  return (
    ({ 3: 1, 10: 13, 11: 9, 12: 10, 13: 11 } as Record<number, number>)[step] ??
    Math.max(0, step - 1)
  );
}
export function storyFollowUp(index: number, answer: string) {
  if (index === 2) {
    return /\b(?:for|because|who|whose)\b/i.test(answer)
      ? "When did you last see that in them?"
      : "What exactly do you admire about them?";
  }
  if (/\b(?:hard time|difficult|lost someone|grief|struggled)\b/i.test(answer))
    return "What did you learn from it that you still carry?";
  if (
    /\bwith (?:my |a |some )?(?:friend|friends|family|sister|brother|daughter|son|partner)\b/i.test(
      answer,
    )
  )
    return "What about being together stayed with you?";
  return index === 1
    ? "What about it pulled you in?"
    : "What did you enjoy about that moment?";
}
export function shouldOfferStoryFollowUp(
  answer: string,
  alreadyOffered: boolean,
) {
  return (
    !alreadyOffered &&
    !isUnreadyAnswer(answer) &&
    answer.trim().split(/\s+/).length >= 6
  );
}
export function storyBody(
  answer: string,
  detail: string,
  question: string,
  keepDetail: boolean,
) {
  return `${answer.trim()}${
    keepDetail && !isUnreadyAnswer(detail)
      ? `\n\n${question}\n${detail.trim()}`
      : ""
  }`;
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
  // Only an invitation to try a value, never a claim or an automatic save.
  return (
    firstAffirmativeValue(stories)?.title || (hasCuriosity ? "Curiosity" : null)
  );
}
