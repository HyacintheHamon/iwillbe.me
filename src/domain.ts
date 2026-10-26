import type { Entry, Energy, Planet, ValueChoice } from "./journey";
export type Outcome = "yes" | "partly" | "not_yet";
export type Profile = {
  display_name: string;
  north_star: string;
  values: string[];
  interests: string[];
  onboarded: boolean;
  timezone: string;
  morning_time: string;
  evening_time: string;
};
export type Intention = {
  id: string;
  day: string;
  action: string;
  value: string;
  interest?: string;
  interest_id?: string | null;
  value_id?: string | null;
  planet?: Planet;
  kind?: "action" | "be";
  when_context?: string;
  place?: string;
  with_person?: string;
  person: string;
  created_at: string;
};
export type CheckIn = {
  intention_id: string;
  outcome: Outcome;
  reflection: string;
  energy?: Energy | null;
  value_choice?: ValueChoice | null;
  created_at: string;
};
export type Memory = {
  id: string;
  content: string;
  source: string;
  created_at: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
export type Practice = {
  profile: Profile;
  intentions: Intention[];
  checkIns: CheckIn[];
  memories: Memory[];
  messages: Message[];
  entries: Entry[];
};
export const VALUES = [
  "Patience",
  "Kindness",
  "Curiosity",
  "Courage",
  "Presence",
  "Creativity",
  "Connection",
  "Balance",
];
export const INTERESTS = [
  "Ceramics",
  "Reading",
  "Cooking",
  "Nature",
  "Music",
  "Learning",
];
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return localDay(date);
}
export function dayLabel(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function nextIntentionDay(practice: Practice, today = localDay()) {
  const intention = practice.intentions.find((i) => i.day === today);
  return intention &&
    practice.checkIns.some((c) => c.intention_id === intention.id)
    ? shiftDay(today, 1)
    : today;
}
export type Dimension = "value" | "interest" | "person";
export function matchesDimension(
  i: Intention,
  dimension: Dimension,
  label: string,
) {
  // Older versions stored interests in the value field. Preserve their meaning.
  if (dimension === "interest")
    return (
      i.interest === label ||
      (!i.interest && INTERESTS.includes(i.value) && i.value === label)
    );
  if (dimension === "value")
    return !INTERESTS.includes(i.value) && i.value === label;
  return i.person === label;
}
export function importConflicts(local: Practice, account: Practice) {
  return local.intentions.filter((i) =>
    account.intentions.some((a) => a.day === i.day && a.id !== i.id),
  );
}
export function hasPractice(practice: Practice) {
  return !!(
    practice.entries?.length ||
    practice.intentions.length ||
    practice.memories.length ||
    practice.profile.onboarded ||
    practice.profile.display_name ||
    practice.profile.values.length ||
    practice.profile.interests.length
  );
}
export function emptyPractice(): Practice {
  return {
    profile: {
      display_name: "",
      north_star: "",
      values: [],
      interests: [],
      onboarded: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      morning_time: "08:00",
      evening_time: "20:30",
    },
    intentions: [],
    checkIns: [],
    memories: [],
    messages: [],
    entries: [],
  };
}
export function activityCount(practice: Practice, label: string) {
  return practice.intentions.filter(
    (i) =>
      i.value === label &&
      practice.checkIns.some(
        (c) =>
          c.intention_id === i.id &&
          (c.outcome === "yes" || c.outcome === "partly"),
      ),
  ).length;
}
export function outcomeLabel(outcome: Outcome) {
  return {
    yes: "I showed up",
    partly: "A small step",
    not_yet: "Not this time",
  }[outcome];
}
export const SUGGESTIONS: Record<string, string[]> = {
  Patience: [
    "Take one breath before responding when I feel rushed.",
    "Give someone my full attention without interrupting.",
  ],
  Kindness: [
    "Send a thoughtful message to someone I care about.",
    "Do one small helpful thing without being asked.",
  ],
  Curiosity: [
    "Spend ten minutes exploring something I have never tried.",
    "Ask someone a question and really listen.",
  ],
  Courage: [
    "Take the first small step on something I have been postponing.",
    "Say what matters to me with care.",
  ],
  Presence: [
    "Put my phone away for a conversation.",
    "Notice three things on a short walk.",
  ],
  Creativity: [
    "Make something small, just for the joy of it.",
    "Spend ten minutes sketching or writing.",
  ],
  Connection: [
    "Call someone I have been meaning to catch up with.",
    "Make time for a shared meal.",
  ],
  Balance: [
    "Take a proper break away from my screen.",
    "Finish my day with a quiet ten-minute walk.",
  ],
  Ceramics: ["Try shaping a small bowl with clay."],
  Reading: ["Read a few pages without distractions."],
  Cooking: ["Cook something simple for someone I care about."],
  Nature: ["Take a short walk and notice what is growing."],
  Music: ["Spend ten minutes playing or listening closely to music."],
  Learning: ["Learn one small thing and put it into practice."],
};
