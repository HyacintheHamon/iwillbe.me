import type { NightThought } from "../_shared/night-thoughts.ts";

// Original reframes, never attributed quotes. Date rotation also works offline.
const REFRAMES = [
  "A life takes shape in ordinary moments, long before it becomes a story we can explain.",
  "What matters can be quiet: a little care, a small responsibility, a moment of attention.",
  "Today does not have to settle the whole question of who you are becoming.",
  "The meaning of a day is sometimes clearer after we have let it rest.",
  "An unfinished day can still belong to a meaningful life.",
  "What we give our attention to becomes part of the life we are living.",
  "A direction can matter even when the next part of the path is not yet clear.",
  "Some of what grows in a life is too quiet to notice on the day it begins.",
  "Care is often ordinary enough to pass unnoticed, and real enough to matter.",
  "There is room for both responsibility and rest in a life that matters to you.",
  "A day is an experience to understand, not a verdict on the person living it.",
  "The life you are shaping includes the people beside you and the small things you choose to give.",
];

export function validNightThought(value: unknown): value is NightThought {
  if (!value || typeof value !== "object") return false;
  const thought = value as Partial<NightThought>;
  return (
    ["quote", "story", "reframe"].includes(thought.format || "") &&
    typeof thought.text === "string" &&
    thought.text.trim().length > 0 &&
    thought.text.length <= 2000 &&
    (thought.format === "reframe" ||
      (typeof thought.credit === "string" && thought.credit.trim().length > 0))
  );
}

export function fallbackNightThought(
  day: string,
  shortlist: NightThought[] = [],
  support = 0,
): NightThought | null {
  if (support >= 2) return null;
  const verified = shortlist.find(
    (thought) => thought.status === "verified" && validNightThought(thought),
  );
  if (verified) return { ...verified, preface: "" };
  const dayNumber = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
  const index = Number.isFinite(dayNumber)
    ? ((dayNumber % REFRAMES.length) + REFRAMES.length) % REFRAMES.length
    : 0;
  return {
    id: 0,
    format: "reframe",
    text: REFRAMES[index],
    person: "",
    source: "",
    credit: "",
    priorities: [],
    traditions: [],
    once_only: false,
    status: "verified",
  };
}
