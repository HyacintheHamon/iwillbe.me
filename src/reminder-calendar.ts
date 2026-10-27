import { dayInZone } from "./journey";
import { shiftDay } from "./domain";

export function validReminderTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function validTimeZone(zone: string) {
  if (!/^[A-Za-z0-9_+\-/]+$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const stamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").slice(0, 15);
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();
function wallParts(date: Date, zone: string) {
  let formatter = zoneFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    if (zoneFormatters.size >= 32) zoneFormatters.clear();
    zoneFormatters.set(zone, formatter);
  }
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
}
export function zoneOffsetMinutes(date: Date, zone: string) {
  const p = wallParts(date, zone);
  const wall = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour,
    +p.minute,
    +p.second,
  );
  return Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
function offsetText(minutes: number) {
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${String(Math.floor(absolute / 60)).padStart(2, "0")}${String(absolute % 60).padStart(2, "0")}`;
}

// Actual timezone transitions let calendar importers handle daylight saving.
// The IANA TZID also lets calendars apply their updated timezone rules.
export function calendarTimeZone(zone: string, year: number) {
  const start = Date.UTC(year - 1, 0, 1);
  const end = Date.UTC(year + 21, 0, 1);
  const week = 7 * 86400000;
  let previousTime = start;
  let previousOffset = zoneOffsetMinutes(new Date(start), zone);
  const groups = new Map<
    string,
    { from: number; to: number; dates: string[] }
  >();
  for (let time = start + week; time <= end + week; time += week) {
    const bound = Math.min(time, end);
    const offset = zoneOffsetMinutes(new Date(bound), zone);
    if (offset !== previousOffset) {
      let lo = previousTime;
      let hi = bound;
      while (hi - lo > 60000) {
        const middle = Math.floor((lo + hi) / 120000) * 60000;
        if (zoneOffsetMinutes(new Date(middle), zone) === previousOffset)
          lo = middle;
        else hi = middle;
      }
      const transition = Math.ceil(hi / 60000) * 60000;
      const key = `${previousOffset}:${offset}`;
      const group = groups.get(key) || {
        from: previousOffset,
        to: offset,
        dates: [],
      };
      group.dates.push(stamp(new Date(transition + previousOffset * 60000)));
      groups.set(key, group);
    }
    previousTime = bound;
    previousOffset = offset;
    if (bound === end) break;
  }
  const lines = ["BEGIN:VTIMEZONE", `TZID:${zone}`, `X-LIC-LOCATION:${zone}`];
  if (!groups.size) {
    const offset = offsetText(previousOffset);
    lines.push(
      "BEGIN:STANDARD",
      `DTSTART:${year - 1}0101T000000`,
      `TZOFFSETFROM:${offset}`,
      `TZOFFSETTO:${offset}`,
      "END:STANDARD",
    );
  }
  for (const group of groups.values()) {
    const kind = group.to > group.from ? "DAYLIGHT" : "STANDARD";
    lines.push(
      `BEGIN:${kind}`,
      `DTSTART:${group.dates[0]}`,
      `TZOFFSETFROM:${offsetText(group.from)}`,
      `TZOFFSETTO:${offsetText(group.to)}`,
    );
    if (group.dates.length > 1)
      lines.push(`RDATE:${group.dates.slice(1).join(",")}`);
    lines.push(`END:${kind}`);
  }
  return [...lines, "END:VTIMEZONE"];
}
function fold(line: string) {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let piece = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 74) {
      lines.push(piece);
      piece = " ";
      bytes = 1;
    }
    piece += char;
    bytes += size;
  }
  return [...lines, piece].join("\r\n");
}
export function reminderCalendar({
  morning,
  evening,
  timezone,
  now = new Date(),
}: {
  morning: string;
  evening: string;
  timezone: string;
  now?: Date;
}) {
  if (!validReminderTime(morning) || !validReminderTime(evening))
    throw new Error("Use a time like 08:00 or 20:30.");
  if (!validTimeZone(timezone))
    throw new Error("Choose a valid timezone, such as America/New_York.");
  const today = dayInZone(timezone, now);
  const clock = wallParts(now, timezone);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//iwillbe.me//Check-in reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${timezone}`,
    ...calendarTimeZone(timezone, +today.slice(0, 4)),
  ];
  for (const [kind, time, title, path, description] of [
    [
      "morning",
      morning,
      "A little room for today",
      "/ritual",
      "One small commitment, then back to your day.",
    ],
    [
      "night",
      evening,
      "A moment to look back",
      "/reflect",
      "A short reflection, when it helps. Then let the night be yours.",
    ],
  ]) {
    const day =
      time <= `${clock.hour}:${clock.minute}` ? shiftDay(today, 1) : today;
    lines.push(
      "BEGIN:VEVENT",
      `UID:iwillbe-${kind}@iwillbe.me`,
      `DTSTAMP:${stamp(now)}Z`,
      `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
      `DTSTART;TZID=${timezone}:${day.replace(/-/g, "")}T${time.replace(":", "")}00`,
      "DURATION:PT2M",
      "RRULE:FREQ=DAILY",
      `SUMMARY:${escapeText(title)}`,
      `DESCRIPTION:${escapeText(description + " Change or remove this recurring reminder in your calendar.")}`,
      `URL:https://iwillbe-me.vercel.app${path}`,
      "TRANSP:TRANSPARENT",
      "CLASS:PRIVATE",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:PT0M",
      `DESCRIPTION:${escapeText(title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
