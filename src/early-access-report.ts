import { dayInZone } from "./journey";

export type ReportParticipant = {
  user_id: string;
  display_name: string;
  email: string | null;
  timezone: string;
  onboarding_complete: boolean;
  onboarding_step: string | null;
  onboarding_cursor: number | null;
  focus_days: number;
  mornings_with_focus: number;
  typed_focuses: number;
  suggested_focuses: number;
  night_checkins: number | null;
  night_checkins_coverage: "collected" | "observed";
  sunday_review_opened: number | null;
  my_map_opened: number | null;
  future_me_opened: number | null;
  screen_metrics_status: "collected" | "partial" | "not_collected";
  screen_metrics_since: string | null;
  last_active_day: string | null;
};

export type EarlyAccessReport = {
  week_start: string;
  week_end_exclusive: string;
  generated_at: string;
  instrumentation_started_at: string;
  participants: ReportParticipant[];
};

export function isReportMonday(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 1
  );
}

export function shiftReportWeek(day: string, weeks: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7 * weeks);
  return date.toISOString().slice(0, 10);
}

export function lastCompleteReportWeek(timezone: string, now = new Date()) {
  const day = new Date(`${dayInZone(timezone, now)}T12:00:00Z`);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - sinceMonday - 7);
  return day.toISOString().slice(0, 10);
}

export function reportCount(value: number | null) {
  return value === null ? "Not collected" : String(value);
}

export function reportOnboarding(person: ReportParticipant) {
  if (person.onboarding_complete) return "Completed";
  return person.onboarding_step
    ? `${person.onboarding_step}${person.onboarding_cursor === null ? "" : ` · card ${person.onboarding_cursor}`}`
    : "Not collected";
}

/** Quote every RFC 4180 field and neutralize spreadsheet-formula injection. */
export function csvCell(value: string | number | boolean | null) {
  const raw = value === null ? "Not collected" : String(value);
  const safe =
    /^[\s]*[=+@-]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function earlyAccessCsv(report: EarlyAccessReport) {
  const headers = [
    "Week starting",
    "Week ending (exclusive)",
    "Name",
    "Email",
    "Timezone",
    "Onboarding complete",
    "Onboarding step",
    "Quick-pick card",
    "Days with focus",
    "Mornings with focus (before 17:00)",
    "Typed focus",
    "Suggested step",
    "Night check-ins",
    "Night coverage",
    "Sunday review opens",
    "My map opens",
    "Future me opens",
    "Screen collection",
    "Screen collection since",
    "Last observed active day",
  ];
  // Explicit projection: even an unexpected API field can never become a CSV
  // column containing a focus, reflection, conversation or other private text.
  const rows = report.participants.map((person) => [
    report.week_start,
    report.week_end_exclusive,
    person.display_name,
    person.email,
    person.timezone,
    person.onboarding_complete ? "Yes" : "No",
    person.onboarding_step,
    person.onboarding_cursor,
    person.focus_days,
    person.mornings_with_focus,
    person.typed_focuses,
    person.suggested_focuses,
    person.night_checkins,
    person.night_checkins_coverage === "collected"
      ? "Collected"
      : "Observed only; earlier no-focus sessions may be missing",
    person.sunday_review_opened,
    person.my_map_opened,
    person.future_me_opened,
    person.screen_metrics_status === "not_collected"
      ? "Not collected"
      : person.screen_metrics_status === "partial"
        ? "Partial; observed opens only"
        : "Collected",
    person.screen_metrics_since,
    person.last_active_day,
  ]);
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
