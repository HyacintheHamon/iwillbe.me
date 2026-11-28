import type { Practice, Intention } from "./domain";
import { entryInput, type Entry, type EntryInput, valueState } from "./journey";
import { priorityName } from "./priorities";

export const ONBOARDING_VERSION = "one-minute-v1";
export const REMINDER_QUESTION =
  "When should I remind you each morning and each night?";
export const PLACE_QUESTION = "Where do you spend most of your day?";
export const CHILDHOOD_QUESTION = "What did you love doing as a kid?";
export const STRENGTH_QUESTION =
  "What do people often tell you you're good at, even if it feels easy to you?";
export const HELP_QUESTION = "Who comes to you for help, and with what?";
export const GROWTH_QUESTION =
  "Is there something you'd like to get better at?";
export const DAY_PLACES = [
  "at home",
  "at work",
  "at school",
  "outdoors",
  "on the road",
];
export const SUNDAY_ONBOARDING_STEPS = {
  1: ["baseline", "childhood", "strengths"],
  2: ["help", "growth"],
} as const;

export type NightFollowup = {
  key: string;
  kind: "reminders" | "places" | "interest" | "priority";
  question: string;
  targetId?: string;
};

export function onboardingSchedule(practice: Practice) {
  return practice.entries.find(
    (entry) =>
      entry.kind === "preferences" &&
      entry.title === "Onboarding schedule" &&
      entry.meta.version === ONBOARDING_VERSION,
  );
}

export function followupRecord(practice: Practice, key: string) {
  return practice.entries.find(
    (entry) =>
      entry.kind === "preferences" &&
      entry.title === "Onboarding follow-up" &&
      entry.meta.followup_key === key,
  );
}

export function completedFollowupRecord(practice: Practice, key: string) {
  const record = followupRecord(practice, key);
  return record &&
    ["answered", "skipped"].includes(record.meta.followup_status || "")
    ? record
    : undefined;
}

/** Individual saved answers are authoritative if the final phase write was interrupted. */
export function sundayOnboardingCompletion(practice: Practice, phase: 1 | 2) {
  const phaseRecord = completedFollowupRecord(practice, `sunday:${phase}`);
  if (phaseRecord) return phaseRecord;
  const steps = SUNDAY_ONBOARDING_STEPS[phase].map((step) =>
    completedFollowupRecord(practice, `sunday:${phase}:${step}`),
  );
  return steps.every(Boolean) ? steps.at(-1) : undefined;
}

export function followupInput(
  practice: Practice,
  key: string,
  question: string,
  day: string,
  status: "shown" | "answered" | "skipped",
  targetId?: string,
): EntryInput {
  const prior = followupRecord(practice, key);
  return entryInput("preferences", "Onboarding follow-up", {
    ...prior,
    body: question,
    source: "A little more of your map",
    meta: {
      ...prior?.meta,
      followup_key: key,
      asked_day: prior?.meta.asked_day || day,
      followup_status: status,
      target_id: targetId,
    },
  });
}

export function openFollowupInput(
  practice: Practice,
  task: NightFollowup,
  day: string,
) {
  const prior = practice.entries.find(
    (entry) =>
      entry.kind === "question" && entry.meta.followup_key === task.key,
  );
  return entryInput("question", task.question, {
    ...prior,
    state: "open",
    source: "Left for another day",
    meta: {
      ...prior?.meta,
      followup_key: task.key,
      target_id: task.targetId,
      last_asked_at: `${day}T12:00:00Z`,
      next_day: new Date(Date.parse(`${day}T12:00:00Z`) + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
    },
  });
}

export function keptPriorityCount(practice: Practice, priority: Entry) {
  const ids = new Set(
    practice.intentions
      .filter((focus) =>
        focus.value_id
          ? focus.value_id === priority.id
          : priorityName(focus.value) === priorityName(priority.title),
      )
      .map((focus) => focus.id),
  );
  return new Set(
    practice.checkIns
      .filter(
        (check) =>
          ids.has(check.intention_id) &&
          check.outcome !== "not_yet" &&
          check.value_choice === "yes",
      )
      .map((check) => check.intention_id),
  ).size;
}

function promotionQuestion(priority: Entry) {
  const names: Record<string, string> = {
    patient: "Patience",
    kind: "Kindness",
    grateful: "Gratitude",
    brave: "Courage",
    curious: "Curiosity",
    honest: "Honesty",
    joyful: "Joy",
    creative: "Creativity",
  };
  const name = names[priorityName(priority.title)] || `Being ${priority.title}`;
  return `${name} keeps showing up. Is it one that's important to you now?`;
}

export function nightFollowup(
  practice: Practice,
  day: string,
  focus?: Intention,
  reflection = "",
): NightFollowup | null {
  const today = practice.entries.find(
    (entry) =>
      entry.kind === "preferences" &&
      entry.title === "Onboarding follow-up" &&
      entry.meta.asked_day === day &&
      !entry.meta.followup_key?.startsWith("sunday:"),
  );
  // A saved reservation also survives reopening the app: answering or skipping
  // it must never reveal a second question on the same local night.
  if (today) {
    if (today.meta.followup_status !== "shown") return null;
    const kind = today.meta.followup_key?.split(":")[0];
    if (!["reminders", "places", "interest", "priority"].includes(kind || ""))
      return null;
    return {
      key: today.meta.followup_key!,
      kind: kind as NightFollowup["kind"],
      question: today.body,
      targetId: today.meta.target_id,
    };
  }
  const schedule = onboardingSchedule(practice);
  if (schedule?.meta.completed_day && day >= schedule.meta.completed_day) {
    const reminders = followupRecord(practice, "reminders");
    if (!reminders)
      return {
        key: "reminders",
        kind: "reminders",
        question: REMINDER_QUESTION,
      };
    if (
      !followupRecord(practice, "places") &&
      (reminders.meta.asked_day || "") < day
    )
      return { key: "places", kind: "places", question: PLACE_QUESTION };
    const age =
      (Date.parse(day) - Date.parse(schedule.meta.completed_day)) / 86400000;
    if (age >= 0 && age < 14) {
      const context =
        `${focus?.interest || ""} ${focus?.action || ""} ${reflection}`.toLowerCase();
      const interest = practice.entries.find(
        (entry) =>
          entry.kind === "interest" &&
          entry.meta.onboarding_session === ONBOARDING_VERSION &&
          !["on_pause", "paused", "ember", "all_in", "craft"].includes(
            entry.state,
          ) &&
          !followupRecord(practice, `interest:${entry.id}`) &&
          !entry.meta.last_stage_asked_day &&
          (focus?.interest_id === entry.id ||
            context.includes(entry.title.toLowerCase())),
      );
      if (interest)
        return {
          key: `interest:${interest.id}`,
          kind: "interest",
          targetId: interest.id,
          question: `Is ${interest.title} new for you, or already part of your life?`,
        };
    }
  }
  const priority = practice.entries.find(
    (entry) =>
      entry.kind === "value" &&
      valueState(practice, entry) === "Working on" &&
      !entry.meta.promotion_asked &&
      !followupRecord(practice, `priority:${entry.id}`) &&
      keptPriorityCount(practice, entry) >= 5,
  );
  return priority
    ? {
        key: `priority:${priority.id}`,
        kind: "priority",
        targetId: priority.id,
        question: promotionQuestion(priority),
      }
    : null;
}

export function sundayOnboardingPhase(
  practice: Practice,
  day: string,
): 1 | 2 | null {
  const schedule = onboardingSchedule(practice);
  if (
    !schedule?.meta.completed_day ||
    day < schedule.meta.completed_day ||
    new Date(`${day}T12:00:00Z`).getUTCDay() !== 0
  )
    return null;
  const first = sundayOnboardingCompletion(practice, 1);
  if (!first) return 1;
  if (first.meta.asked_day === day) return null;
  return sundayOnboardingCompletion(practice, 2) ? null : 2;
}

export function isShortOnboardingSunday(practice: Practice, day: string) {
  return (
    !!sundayOnboardingPhase(practice, day) ||
    ([1, 2] as const).some(
      (phase) =>
        sundayOnboardingCompletion(practice, phase)?.meta.asked_day === day,
    )
  );
}
