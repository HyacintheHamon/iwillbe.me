import type { Level, Round2Mission } from "./round2";

export const CHLOE_INTRO =
  "I'm Chloe. You do the living, I help you pick one thing a day and ask how it went.";
export const AI_DISCLOSURE =
  "Chloe uses AI. She can make mistakes and isn't a therapist.";
export const FIRST_TODAY_OPENER =
  "You can type your own focus, or scroll for an idea. Pick one thing for today, and I'll ask how it went tonight.";

export function localHour(timezone: string, now = new Date()) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(now),
    );
  } catch {
    return now.getUTCHours();
  }
}

export function planChoices(hour: number) {
  return hour >= 17
    ? ["now", "after dinner", "at bedtime"]
    : ["morning", "lunch", "after work", "bedtime"];
}

export type PendingFocus = {
  text: string;
  source: "typed" | "suggested";
  missionId: string | null;
  missionStep: number | null;
  level: Level | null;
  type: "do" | "learn";
  priority: string;
  interest: string;
  place: string;
  somedayId: string | null;
  missionSnapshot?: Round2Mission;
};

export function pendingFromMission(
  mission: Round2Mission,
  context: Partial<PendingFocus> = {},
): PendingFocus {
  return {
    text: mission.mission_text,
    source: "suggested",
    missionId: mission.id,
    missionStep: mission.ladder_step,
    level: mission.level as Level,
    type: mission.type as "do" | "learn",
    priority: "",
    interest: "",
    place: "",
    somedayId: null,
    missionSnapshot: mission,
    ...context,
  };
}
