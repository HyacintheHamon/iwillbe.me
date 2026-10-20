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
  person: string;
  created_at: string;
};
export type CheckIn = {
  intention_id: string;
  outcome: Outcome;
  reflection: string;
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
    not_yet: "Another chance tomorrow",
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
