import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarTimeZone,
  reminderCalendar,
  validTimeZone,
  zoneOffsetMinutes,
} from "../src/reminder-calendar";

test("calendar reminders start in the profile's day and keep morning/night separate", () => {
  const calendar = reminderCalendar({
    morning: "08:00",
    evening: "20:30",
    timezone: "America/New_York",
    now: new Date("2026-10-27T00:15:00Z"),
  }).replace(/\r\n /g, "");
  assert.match(calendar, /DTSTART;TZID=America\/New_York:20261027T080000/);
  assert.match(calendar, /DTSTART;TZID=America\/New_York:20261026T203000/);
  assert.equal((calendar.match(/RRULE:FREQ=DAILY/g) || []).length, 2);
  assert.equal((calendar.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(calendar, /URL:https:\/\/iwillbe-me.vercel.app\/reflect/);
  assert.doesNotMatch(calendar, /UNTIL=|COUNT=/);
});
test("daylight saving and half-hour zones are represented explicitly", () => {
  assert.equal(
    zoneOffsetMinutes(new Date("2026-03-08T06:59:00Z"), "America/New_York"),
    -300,
  );
  assert.equal(
    zoneOffsetMinutes(new Date("2026-03-08T07:00:00Z"), "America/New_York"),
    -240,
  );
  assert.equal(
    zoneOffsetMinutes(new Date("2026-11-01T06:00:00Z"), "America/New_York"),
    -300,
  );
  assert.equal(
    zoneOffsetMinutes(new Date("2026-10-26T12:00:00Z"), "Asia/Kolkata"),
    330,
  );
  const zone = calendarTimeZone("America/New_York", 2026).join("\n");
  assert.match(zone, /20260308T020000/);
  assert.match(zone, /20261101T020000/);
  assert.match(zone, /TZOFFSETFROM:-0500\nTZOFFSETTO:-0400/);
  assert.match(
    calendarTimeZone("Asia/Kolkata", 2026).join("\n"),
    /TZOFFSETTO:\+0530/,
  );
});
test("calendar export rejects invalid times/zone injection and folds long records", () => {
  assert.equal(validTimeZone("UTC\r\nBEGIN:VEVENT"), false);
  assert.throws(() =>
    reminderCalendar({ morning: "25:30", evening: "20:30", timezone: "UTC" }),
  );
  assert.throws(() =>
    reminderCalendar({
      morning: "08:00",
      evening: "20:30",
      timezone: "Unknown/Zone",
    }),
  );
  const calendar = reminderCalendar({
    morning: "08:00",
    evening: "20:30",
    timezone: "Europe/Paris",
    now: new Date("2026-10-26T15:00:00Z"),
  });
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
  assert.ok(
    calendar
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  );
  assert.doesNotMatch(calendar, /stories|private thought|anchor|commitment:/i);
});
