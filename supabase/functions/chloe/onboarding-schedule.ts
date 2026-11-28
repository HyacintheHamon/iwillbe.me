type SavedEntry = {
  id?: string;
  kind?: string;
  title?: string;
  body?: string;
  state?: string;
  meta?: Record<string, unknown>;
};

const VERSION = "one-minute-v1";
const regularWhyQuestions = [
  "When did time disappear on you recently?",
  "Who do you admire, and why?",
];
const date = (value: unknown): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

/** Mirror the app's completed-session markers, so missed Sundays never erase
 * the baseline and a same-day reopen cannot become the next Sunday phase. */
export function onboardingFlowContext(entries: SavedEntry[], day: string) {
  const schedule = entries.find(
    (entry) =>
      entry.kind === "preferences" &&
      entry.title === "Onboarding schedule" &&
      entry.meta?.version === VERSION,
  );
  const followups = entries.filter(
    (entry) =>
      entry.kind === "preferences" &&
      entry.title === "Onboarding follow-up" &&
      typeof entry.meta?.followup_key === "string",
  );
  const completed = (key: string) =>
    followups.find(
      (entry) =>
        entry.meta?.followup_key === key &&
        ["answered", "skipped"].includes(
          String(entry.meta.followup_status || ""),
        ),
    );
  const phaseCompletion = (phase: 1 | 2, steps: string[]) => {
    const marker = completed(`sunday:${phase}`);
    if (marker) return marker;
    // Match the app's crash recovery: each saved answer remains authoritative
    // if the session ended before its final phase marker could be written.
    const answers = steps.map((step) => completed(`sunday:${phase}:${step}`));
    return answers.every(Boolean) ? answers.at(-1) : undefined;
  };
  const first = phaseCompletion(1, ["baseline", "childhood", "strengths"]);
  const second = phaseCompletion(2, ["help", "growth"]);
  const completedDay = date(schedule?.meta?.completed_day);
  const isSunday = new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
  let sundayPhase: 1 | 2 | null = null;
  let nextRegularWhy: string | null = null;
  if (completedDay && completedDay <= day && isSunday) {
    if (!first || first.meta?.asked_day === day) sundayPhase = 1;
    else if (!second || second.meta?.asked_day === day) sundayPhase = 2;
    else {
      const secondDay = date(second.meta?.asked_day);
      const reviewedWeeks = new Set(
        entries
          .filter(
            (entry) =>
              entry.kind === "review" &&
              entry.title === "Sunday review" &&
              entry.state === "done" &&
              typeof entry.meta?.period === "string" &&
              entry.meta.period.startsWith("week:") &&
              !!secondDay &&
              entry.meta.period.slice(5) > secondDay &&
              entry.meta.period.slice(5) < day,
          )
          .map((entry) => entry.meta?.period),
      );
      nextRegularWhy = regularWhyQuestions[reviewedWeeks.size] || null;
    }
  }
  return {
    onboarding_schedule: schedule?.meta || null,
    onboarding_followups: followups.map((entry) => ({
      id: entry.id,
      question: entry.body || "",
      ...entry.meta,
    })),
    onboarding_sunday_phase: sundayPhase,
    onboarding_regular_why_question: nextRegularWhy,
    onboarding_night_question_today: followups.some(
      (entry) =>
        entry.meta?.asked_day === day &&
        !String(entry.meta.followup_key).startsWith("sunday:"),
    ),
  };
}
