import test from "node:test";
import assert from "node:assert/strict";
import {
  csvCell,
  earlyAccessCsv,
  isReportMonday,
  lastCompleteReportWeek,
  shiftReportWeek,
  type EarlyAccessReport,
  type ReportParticipant,
} from "../src/early-access-report";

test("weekly report dates are local Mondays and survive month/year boundaries", () => {
  assert.equal(
    lastCompleteReportWeek(
      "America/New_York",
      new Date("2026-11-16T02:00:00Z"),
    ),
    "2026-11-02",
  );
  assert.equal(
    lastCompleteReportWeek(
      "America/New_York",
      new Date("2026-11-16T06:00:00Z"),
    ),
    "2026-11-09",
  );
  assert.equal(shiftReportWeek("2026-12-28", 1), "2027-01-04");
  assert.ok(isReportMonday("2026-11-09"));
  assert.equal(isReportMonday("2026-11-10"), false);
  assert.equal(isReportMonday("2026-02-30"), false);
  assert.equal(isReportMonday("not-a-day"), false);
});

test("CSV quotes multiline names and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('Jo, "Kelly"\nSmith'), '"Jo, ""Kelly""\nSmith"');
  for (const dangerous of [
    "=HYPERLINK(1)",
    "+SUM(1)",
    "@SUM(1)",
    "-1+2",
    " \t=1",
    "\tmessage",
  ]) {
    assert.ok(csvCell(dangerous).startsWith("\"'"));
  }
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(null), '"Not collected"');
});

test("CSV keeps unknown distinct from zero and exports only the content-free projection", () => {
  const person: ReportParticipant & { private_reflection: string } = {
    user_id: "fixture",
    display_name: "=1+1",
    email: "fixture@example.test",
    timezone: "UTC",
    onboarding_complete: false,
    onboarding_step: "Quick picks",
    onboarding_cursor: 3,
    focus_days: 0,
    mornings_with_focus: 0,
    typed_focuses: 0,
    suggested_focuses: 0,
    night_checkins: null,
    night_checkins_coverage: "observed",
    sunday_review_opened: null,
    my_map_opened: 0,
    future_me_opened: null,
    screen_metrics_status: "partial",
    screen_metrics_since: "2026-11-10T12:00:00Z",
    last_active_day: "2026-11-11",
    private_reflection: "INTIMATE TEXT MUST NEVER LEAVE",
  };
  const report: EarlyAccessReport = {
    week_start: "2026-11-09",
    week_end_exclusive: "2026-11-16",
    generated_at: "2026-11-16T12:00:00Z",
    instrumentation_started_at: "2026-11-09T12:00:00Z",
    participants: [person],
  };
  const csv = earlyAccessCsv(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"Not collected"'));
  assert.ok(csv.includes('"0"'));
  assert.ok(csv.includes("Partial; observed opens only"));
  assert.ok(!csv.includes(person.private_reflection));
  assert.ok(!csv.includes("private_reflection"));
  assert.ok(csv.endsWith("\r\n"));
});
