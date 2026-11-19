import type { Practice } from "./domain";

export const KIDS_AGES = ["under 6", "6–12", "teens"] as const;
export type KidsAge = (typeof KIDS_AGES)[number];
export const HEALTH_THEMES = [
  "moving",
  "eating well",
  "sleep",
  "water",
  "rest and stress",
  "check-ups",
  "cutting back",
] as const;

export function kidsAgesPreference(practice: Practice) {
  return practice.entries.find(
    (entry) => entry.kind === "preferences" && entry.title === "Kids ages",
  );
}

export function shouldAskKidsAges(
  practice: Practice,
  context: string,
  force = false,
) {
  const saved = kidsAgesPreference(practice);
  if (
    saved?.meta.asked ||
    saved?.meta.ages?.some((age) => KIDS_AGES.includes(age))
  )
    return false;
  if (force) return true;
  const text = context.toLowerCase().replaceAll("’", "'");
  if (
    /\b(?:i|we) (?:do not|don't) have (?:any )?(?:kids|children)\b/.test(text)
  )
    return false;
  return /\b(?:my|our) (?:kids?|children|child|sons?|daughters?|toddlers?|teens?|teenagers?)\b|\bmes enfants\b/.test(
    text,
  );
}

export function priorityThemePreference(practice: Practice, priority: string) {
  return practice.entries.find(
    (entry) =>
      entry.kind === "preferences" &&
      entry.title === "Priority theme" &&
      entry.meta.priority === priority,
  );
}

export function shouldAskPriorityTheme(practice: Practice, priority: string) {
  if (priority.trim().toLowerCase() !== "healthy") return false;
  const saved = priorityThemePreference(practice, "healthy");
  return !saved?.meta.asked && !saved?.meta.theme;
}
