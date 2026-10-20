import type { Practice } from "./domain";

export const PLANETS = [
  "Be",
  "People",
  "Causes",
  "Passions",
  "Grow",
  "Surprise",
] as const;
export type Planet = (typeof PLANETS)[number];
export type Energy = "lit" | "neutral" | "drained";
export type ValueChoice = "yes" | "not_sure" | "not_mine";
export type EntryKind =
  | "interest"
  | "value"
  | "strength"
  | "person"
  | "why"
  | "story"
  | "vision"
  | "review"
  | "question"
  | "backlog"
  | "preferences"
  | "event";
export type Entry = {
  id: string;
  kind: EntryKind;
  title: string;
  body: string;
  state: string;
  source: string;
  source_ids: string[];
  created_at: string;
  updated_at: string;
  meta: {
    planet?: Planet;
    planet_notes?: Partial<Record<Planet, string>>;
    answers?: (number | null)[];
    period?: string;
    version?: number;
    horizon?: "year" | "life";
    scores_visible?: boolean;
    analytics?: boolean;
    pace?: "stay" | "vary" | "guide";
    orbit?: Planet;
    passes?: number;
    next_day?: string;
    stopped?: boolean;
    step?: number;
    cursor?: number;
    sort?: Record<string, string>;
    blocks?: string[];
    last_comet_day?: string;
    last_comet_token?: string;
    lock?: boolean;
  };
};
export type EntryInput = Omit<Entry, "id" | "created_at" | "updated_at"> & {
  id?: string;
};
export function entryInput(
  kind: EntryKind,
  title: string,
  extra: Partial<EntryInput> = {},
): EntryInput {
  return {
    kind,
    title,
    body: "",
    state: "active",
    source: "Chosen by you",
    source_ids: [],
    meta: {},
    ...extra,
  };
}
export function entriesOf(p: Practice, kind: EntryKind) {
  return (p.entries || []).filter((e) => e.kind === kind);
}
export function currentWhy(p: Practice) {
  return entriesOf(p, "why")
    .filter((e) => e.state === "accepted")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
export function interestState(
  p: Practice,
  e: Entry,
): "Spark" | "Glow" | "Blaze" | "Ember" | "Craft" {
  if (e.state === "craft") return "Craft";
  if (e.state === "ember") return "Ember";
  const ids = new Set(
    p.intentions
      .filter((i) =>
        i.interest_id ? i.interest_id === e.id : i.interest === e.title,
      )
      .map((i) => i.id),
  );
  const lit = p.checkIns.filter(
    (c) =>
      ids.has(c.intention_id) && c.outcome !== "not_yet" && c.energy === "lit",
  ).length;
  return lit >= 3 ? "Blaze" : lit > 0 || e.state === "love" ? "Glow" : "Spark";
}
export function valueState(
  p: Practice,
  e: Entry,
): "Flicker" | "Steady" | "Drift" {
  const ids = new Set(
    p.intentions
      .filter((i) => (i.value_id ? i.value_id === e.id : i.value === e.title))
      .map((i) => i.id),
  );
  const choices = p.checkIns
    .filter((c) => ids.has(c.intention_id) && c.value_choice)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (choices[0]?.value_choice === "not_mine") return "Drift";
  return choices.filter((c) => c.value_choice === "yes").length >= 2
    ? "Steady"
    : "Flicker";
}
export const REVIEW_QUESTIONS = [
  "How much did this month feel like your life, not one you were just going along with?",
  "How much did your days feel like they mattered this month?",
  "How connected did you feel to the people around you?",
];
export const STORIES = [
  "When did you last lose track of time?",
  "What did you love doing as a child?",
  "Who do you admire, and what do you admire about them?",
];
export const ENERGY_LABELS = {
  lit: "Lit me up",
  neutral: "Neutral",
  drained: "Drained me",
};
export function dayInZone(timezone: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
export function rhythmDue(p: Practice, now = new Date()) {
  const day = dayInZone(p.profile.timezone, now);
  const reviews = entriesOf(p, "review");
  const month = day.slice(0, 7);
  // Full Moon is a monthly reflection name, scheduled by calendar month, not an astronomical claim.
  const completed = (period: string) =>
    reviews.some(
      (r) =>
        r.meta.period === period &&
        (r.state === "done" || (r.meta.next_day || "") > day),
    );
  if (!completed(`moon:${month}`))
    return {
      kind: "monthly",
      period: `moon:${month}`,
      title: "Your Full Moon reflection",
      day,
    };
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const week = d.toISOString().slice(0, 10);
  if (!completed(`week:${week}`))
    return {
      kind: "weekly",
      period: `week:${week}`,
      title: "One question for your week",
      day,
    };
  return null;
}
export function suggestedPlanet(p: Practice, day: string): Planet {
  const preferences = entriesOf(p, "preferences").find(
    (e) => e.title === "Season",
  );
  if (preferences?.meta.pace === "stay") return preferences.meta.orbit || "Be";
  const index = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000) % 5;
  if (preferences?.meta.pace === "vary") return PLANETS[index];
  const recent = p.intentions.slice(0, 4);
  return recent.filter((i) => i.person && i.person !== "me").length >= 3
    ? "Passions"
    : PLANETS[index];
}
export const PLANET_PROMPTS: Record<Planet, string> = {
  Be: "How would you like to show up today?",
  People: "Who would you like to make a little room for?",
  Causes: "What could you do for something you care about?",
  Passions: "What have you been curious to try?",
  Grow: "What is one small thing you would like to learn?",
  Surprise: "What would make today a little different?",
};
