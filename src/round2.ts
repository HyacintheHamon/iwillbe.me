import type { Practice, Intention } from "./domain";
import { interestState, valueState, weekPeriod } from "./journey";
import { priorityName } from "./priorities";
import catalogue from "../data/round3/missions.json";
import links from "../data/round3/interest-links.json";
import shelf from "../data/round3/learning-shelf.json";
import { selectMission, somedaySelection } from "./mission-selection";
export {
  selectMission,
  somedaySelection,
  missionFamilyId,
  missionTheme,
  missionUnavailableReason,
} from "./mission-selection";
export type {
  MissionSelection,
  MissionSelectionOptions,
} from "./mission-selection";

export type Level = "easy" | "normal" | "stretch";
export type FocusType = "do" | "learn";
export type Round2Mission = Omit<
  (typeof catalogue)[number],
  "ages" | "family_id" | "theme"
> & {
  ages?: string[];
  family_id?: string;
  theme?: string;
};
export const MISSIONS: Round2Mission[] = catalogue;
export const INTEREST_LINKS = links;
export const LEARNING_SHELF = shelf;
export const LEVELS: Level[] = ["easy", "normal", "stretch"];
export const STAGES = [
  "Want to try",
  "From time to time",
  "Into it",
  "All in",
  "On pause",
] as const;
export const STAGE_VALUES = [
  "want_to_try",
  "from_time_to_time",
  "into_it",
  "all_in",
  "on_pause",
] as const;
export const HORIZONS = {
  this_year: "This year",
  five_years: "In 5 years",
  ten_years: "In 10 years",
  later_in_life: "Later in life",
} as const;
export type Place = {
  id: string;
  user_id?: string;
  label: string;
  sort_order: number;
};
export type Someday = {
  id: string;
  text: string;
  horizon: keyof typeof HORIZONS;
  status: "open" | "lived" | "let_go";
  priority?: string;
  interest?: string;
  revision?: number;
  created_at?: string;
};
export type MomentType =
  | "narrowing"
  | "all_in_check"
  | "worst_case"
  | "cost_of_waiting"
  | "people_question"
  | "stretch_nudge"
  | "learning"
  | "someday_link"
  | "seasonal_look_back";
export type Moment = { type: MomentType; session_id: string; asked_at: string };
export type Opener = {
  kind: "carry_forward" | "meaning_to" | "stretch";
  text: string;
  focus_text?: string;
  item_id?: string;
  mission_id?: string;
};
export type Summary = {
  day: string;
  hard_day: boolean;
  summary: string;
  opener_line: Opener | null;
};
export const norm = (s: string) => s.trim().toLowerCase();
export function priorityOptions(p: Practice) {
  const today = new Date().toISOString().slice(0, 10);
  const weekly = p.entries.find(
    (e) =>
      e.kind === "preferences" &&
      e.title === "Weekly priority" &&
      e.meta.period === weekPeriod(today),
  )?.body;

  return p.entries
    .filter((e) => e.kind === "value" && valueState(p, e) !== "Let go")
    .sort(
      (a, b) =>
        Number(valueState(p, b) === "Working on") -
          Number(valueState(p, a) === "Working on") ||
        Number(b.title === weekly) - Number(a.title === weekly),
    )
    .map((e) => priorityName(e.title))
    .filter((v, i, a) => a.indexOf(v) === i);
}
export function whereOptions(p: Practice, places: Place[]) {
  return [
    { id: "anywhere", label: "anywhere", kind: "anywhere" },
    ...places
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((x) => ({ id: x.id, label: x.label, kind: "place" })),
    ...p.entries
      .filter(
        (e) => e.kind === "interest" && interestState(p, e) !== "On pause",
      )
      .sort(
        (a, b) =>
          STAGES.indexOf(interestState(p, b)) -
          STAGES.indexOf(interestState(p, a)),
      )
      .map((e) => ({ id: e.id, label: e.title, kind: "interest" })),
  ];
}
export function similarInterests(p: Practice, limit = 3, anchor?: string) {
  const known = new Set(
    p.entries.filter((e) => e.kind === "interest").map((e) => norm(e.title)),
  );
  const ordered = anchor
    ? [{ label: anchor }]
    : whereOptions(p, []).filter((x) => x.kind === "interest");
  const result: typeof links = [];
  for (const item of ordered)
    for (const link of links.filter(
      (l) => norm(l.interest) === norm(item.label),
    )) {
      if (
        !known.has(norm(link.similar_interest)) &&
        !result.some((l) => l.similar_interest === link.similar_interest)
      )
        result.push(link);
    }
  return result.slice(0, limit);
}
export function nextLadderStep(p: Practice, ladder: string) {
  const done = p.intentions.filter(
    (i) =>
      i.mission_id &&
      p.checkIns.some((c) => c.intention_id === i.id && c.outcome === "yes"),
  );
  return Math.min(
    5,
    Math.max(
      1,
      ...done
        .filter(
          (i) => MISSIONS.find((m) => m.id === i.mission_id)?.ladder === ladder,
        )
        .map((i) => (i.mission_step || 1) + 1),
    ),
  );
}
export function pickMission(
  p: Practice,
  priority: string,
  where: string,
  kind: string,
  level: Level = "easy",
  type: FocusType = "do",
  day = new Date().toISOString().slice(0, 10),
  pool = MISSIONS,
): Round2Mission | undefined {
  return selectMission(p, { priority, where, kind, level, type, day, pool })
    .mission;
}
export function somedayMission(p: Practice, item: Someday, level: Level) {
  return somedaySelection(p, item, level).mission;
}
export function isHardDay(text: string) {
  return /\b(rough|hard|bad|awful|stressful|tough) (day|week)\b|\b(exhausted|overwhelmed|drained|burnt out)\b/i.test(
    text,
  );
}
export function rareMomentAllowed(
  moments: Moment[],
  type: MomentType,
  session: string,
  hardDay: boolean,
  now = new Date(),
) {
  return (
    !hardDay &&
    !moments.some(
      (m) =>
        m.session_id === session ||
        (m.type === type &&
          now.getTime() - Date.parse(m.asked_at) < 7 * 86400000),
    )
  );
}
export function seasonalSunday(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return (
    d.getUTCDay() === 0 &&
    d.getUTCDate() <= 7 &&
    [2, 5, 8, 11].includes(d.getUTCMonth())
  );
}
export function livedFocuses(
  p: Practice,
  day: string,
  season = seasonalSunday(day),
): Intention[] {
  const start = new Date(`${day}T12:00:00Z`);
  if (season) start.setUTCMonth(start.getUTCMonth() - 3);
  else start.setUTCDate(start.getUTCDate() - 6);
  return p.intentions
    .filter(
      (i) =>
        i.day >= start.toISOString().slice(0, 10) &&
        i.day <= day &&
        p.checkIns.some(
          (c) =>
            c.intention_id === i.id && ["yes", "partly"].includes(c.outcome),
        ),
    )
    .sort((a, b) => a.day.localeCompare(b.day));
}
export function strengthMatches(text: string, words: string[]) {
  const aliases: Record<string, string[]> = {
    patient: ["patience", "patient", "listening"],
    kind: ["kind", "helping", "caring"],
    calm: ["calm", "calming"],
    creative: ["creative", "creativity", "drawing", "design"],
    "a clear thinker": ["problem solving", "problems", "logical"],
    "a leader": ["lead", "leadership", "organis", "organiz"],
    "good with people": ["people", "listening", "empathy"],
    wise: ["advice", "wise"],
    brave: ["courage", "brave"],
  };
  return words
    .filter((w) =>
      [w, ...(aliases[w] || [])].some((x) => norm(text).includes(x)),
    )
    .slice(0, 4);
}
