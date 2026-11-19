import type { Mission } from "../_shared/missions.ts";
import { missionTag } from "../_shared/missions.ts";
import { localContextDay } from "./prompt.ts";

export type PersonalMission = Mission & {
  family_id?: string;
  ages?: string[];
  theme?: string;
  interests?: string[];
  places?: string[];
  level?: string;
};
export type MissionMoment = {
  day: string;
  hour: number;
  weekend: boolean;
  ages: string[];
  priority: string;
  where: string;
  kind: string;
};
export const KID_AGE_BANDS = ["under 6", "6–12", "teens"];
export const HEALTH_THEME_NAMES = [
  "moving",
  "eating well",
  "sleep",
  "water",
  "rest and stress",
  "check-ups",
  "cutting back",
];

export function missionMoment(timezone: string | undefined, now = new Date()) {
  const day = localContextDay(timezone, now);
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone || "UTC",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(now),
    );
  } catch {
    hour = now.getUTCHours();
  }
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return { day, hour, weekend: weekday === 0 || weekday === 6 };
}

export function missionFitsSavedContext(
  mission: PersonalMission,
  moment: MissionMoment,
) {
  if (
    moment.priority &&
    !mission.priorities.some(
      (priority) => missionTag(priority) === moment.priority,
    )
  )
    return false;
  if (
    moment.kind === "place" &&
    !mission.places?.some((place) => missionTag(place) === moment.where)
  )
    return false;
  if (
    moment.kind === "interest" &&
    !mission.interests?.some(
      (interest) => missionTag(interest) === moment.where,
    )
  )
    return false;
  if (
    mission.ages?.length &&
    !mission.ages.some((age) => moment.ages.includes(age))
  )
    return false;
  const text = `${mission.mission_text} ${mission.first_step}`.toLowerCase();
  const outing =
    ["Outdoors", "Out and about", "Work or school"].includes(mission.setting) ||
    /\b(shop for|go shopping|grocery store|donation cent(?:er|re)|animal shelter|opening hours)\b/.test(
      text,
    ) ||
    (mission.setting !== "Online" &&
      /\b(call|book|attend|visit|go to)\b/.test(text) &&
      /\b(doctor|dentist|check[ -]?up|appointment|clinic|bank|post office)\b/.test(
        text,
      ));
  if (outing && !(moment.hour >= 5 && moment.hour < 12)) return false;
  if (
    moment.hour >= 17 &&
    !["Home", "Anywhere", "Phone", "Online"].includes(mission.setting)
  )
    return false;
  if (!moment.weekend && mission.size === "Normal" && mission.minutes > 30)
    return false;
  if (!moment.weekend && mission.size === "Stretch" && mission.minutes >= 120)
    return false;
  if (moment.hour >= 10 && /before 10\s?am/.test(text)) return false;
  if (moment.hour >= 12 && /(?:by|before) noon/.test(text)) return false;
  if (
    !moment.weekend &&
    /^(do that one thing|take a full day).*weekend/.test(text)
  )
    return false;
  if (
    moment.where === "with my kids" &&
    !moment.ages.includes("teens") &&
    /\b(résumé|resume|internship|college|teenager|teen|job application)\b/.test(
      text,
    )
  )
    return false;
  if (
    moment.priority === "healthy" &&
    /\b(calories|calorie|diet|diets|weight loss|lose weight|weigh yourself)\b/.test(
      text,
    )
  )
    return false;
  return true;
}

export function personalMissionFamily(mission: PersonalMission) {
  return mission.family_id || mission.id.replace(/[abc]$/, "");
}

export function matchingFamily(
  rows: PersonalMission[],
  moment: MissionMoment,
  excludedMissionIds: string[] = [],
) {
  const excludedFamilies = new Set(
    rows
      .filter((mission) => excludedMissionIds.includes(mission.id))
      .map(personalMissionFamily),
  );
  const families = new Map<string, PersonalMission[]>();
  for (const row of rows.filter(
    (mission) =>
      missionFitsSavedContext(mission, moment) &&
      !excludedFamilies.has(personalMissionFamily(mission)),
  )) {
    const family = personalMissionFamily(row);
    families.set(family, [...(families.get(family) || []), row]);
  }
  return [...families.values()]
    .find((family) =>
      ["5-minute", "Normal", "Stretch"].every((size) =>
        family.some((mission) => mission.size === size),
      ),
    )
    ?.filter(
      (mission, index, family) =>
        family.findIndex((other) => other.size === mission.size) === index,
    );
}
