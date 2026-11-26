import type { Practice } from "./domain";
import type { FocusType, Level, Round2Mission, Someday } from "./round2";
import { priorityName } from "./priorities";
import catalogue from "../data/round4/missions.json";

const LEVELS: Level[] = ["easy", "normal", "stretch"];
const normalise = (value: string) => value.trim().toLowerCase();
export const KIDS_AGES = ["under 6", "6–12", "teens"] as const;
export const HEALTH_THEMES = [
  "moving",
  "eating well",
  "sleep",
  "water",
  "rest and stress",
  "check-ups",
  "cutting back",
] as const;

export type MissionSelectionOptions = {
  priority: string;
  where: string;
  kind: string;
  level?: Level;
  type?: FocusType;
  now?: Date;
  day?: string;
  familyId?: string;
  /** Independent Round 4 wheels. Explicit choices are never silently cleared. */
  interest?: string;
  place?: string;
  excludedFamilyIds?: readonly string[];
  pool?: readonly Round2Mission[];
};
export type MissionSelection = {
  mission: Round2Mission | undefined;
  familyId: string | undefined;
  variants: Partial<Record<Level, Round2Mission>>;
  availableLevels: Level[];
  unavailableReasons: Partial<Record<Level, string>>;
  effectiveWhere: string;
  effectiveKind: string;
  whereCleared: boolean;
  theme?: string;
};

// Extra ideas such as GR-FIT-1a2 are their own family, never merged with 1a/1b/1c.
export function missionFamilyId(
  mission: Pick<Round2Mission, "id" | "family_id"> | string,
) {
  const id = typeof mission === "string" ? mission : mission.id;
  if (typeof mission !== "string" && mission.family_id)
    return mission.family_id;
  if (id.startsWith("personal-"))
    return id.replace(/-(?:5-minute|Normal|Stretch)$/, "");
  const match = /^(.*?)[abc](\d*)$/.exec(id);
  return match ? match[1] + (match[2] ? `#${match[2]}` : "") : id;
}

export function missionTheme(mission: Round2Mission, priority = "healthy") {
  if (priorityName(priority) !== "healthy") return undefined;
  if (mission.theme) return mission.theme;
  if (
    mission.tags[0] === "health" &&
    HEALTH_THEMES.some((t) => t === mission.tags[1])
  )
    return mission.tags[1];
  if (/^(GR-FIT|PA-SPO|IN-YOG)-/.test(mission.id)) return "moving";
  return undefined;
}

export function savedKidsAges(practice: Practice): string[] {
  const entry = practice.entries
    .filter((e) => e.kind === "preferences" && e.title === "Kids ages")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  return (entry?.meta.ages || []).filter((age) =>
    KIDS_AGES.some((allowed) => allowed === age),
  );
}

type Moment = { day: string; hour: number; weekend: boolean };
export function missionLocalMoment(
  practice: Practice,
  now = new Date(),
  day?: string,
): Moment {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: practice.profile.timezone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: "UTC",
    }).formatToParts(now);
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "00";
  const localDay = day || `${part("year")}-${part("month")}-${part("day")}`;
  const weekday = new Date(`${localDay}T12:00:00Z`).getUTCDay();
  return {
    day: localDay,
    hour: Number(part("hour")),
    weekend: weekday === 0 || weekday === 6,
  };
}

// Use the supplied setting plus explicit outings in otherwise at-home tasks.
// A doorstep delivery (KK-01/05) is explicitly an evening example in Round 3.
function needsMorning(mission: Round2Mission) {
  if (["Outdoors", "Out and about", "Work or school"].includes(mission.setting))
    return true;
  const text = normalise(`${mission.mission_text} ${mission.first_step}`);
  if (
    /\b(shop for|go shopping|grocery store|donation cent(?:er|re)|animal shelter|opening hours)\b/.test(
      text,
    )
  )
    return true;
  return (
    mission.setting !== "Online" &&
    /\b(call|book|attend|visit|go to)\b/.test(text) &&
    /\b(doctor|dentist|check[ -]?up|appointment|clinic|bank|post office)\b/.test(
      text,
    )
  );
}

export function missionUnavailableReason(
  mission: Round2Mission,
  practice: Practice,
  now = new Date(),
  day?: string,
): string | undefined {
  return unavailableAt(
    mission,
    savedKidsAges(practice),
    missionLocalMoment(practice, now, day),
  );
}

function unavailableAt(
  mission: Round2Mission,
  ages: string[],
  moment: Moment,
): string | undefined {
  if (mission.ages?.length && !mission.ages.some((age) => ages.includes(age)))
    return ages.length
      ? "For a different age group."
      : "Choose your kids’ ages first.";
  const morning = moment.hour >= 5 && moment.hour < 12;
  if (needsMorning(mission) && !morning)
    return "Try this outing in the morning.";
  if (!moment.weekend && mission.level === "normal" && mission.minutes > 30)
    return "Save this longer step for the weekend.";
  if (!moment.weekend && mission.level === "stretch" && mission.minutes >= 120)
    return "Save this longer stretch for the weekend.";
  const text = normalise(mission.mission_text);
  if (
    !moment.weekend &&
    /^(do that one thing|take a full day).*weekend/.test(text)
  )
    return "Save this step for the weekend.";
  if (moment.hour >= 10 && /before 10\s?am/.test(text))
    return "Try this step tomorrow morning.";
  if (moment.hour >= 12 && /(?:by|before) noon/.test(text))
    return "Try this step tomorrow morning.";
  if (
    moment.hour >= 17 &&
    !["Home", "Anywhere", "Phone", "Online"].includes(mission.setting)
  )
    return "Choose a step you can do at home tonight.";
  return undefined;
}

function hash(value: string) {
  let result = 2166136261;
  for (const character of value)
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
function dayNumber(day: string) {
  return Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
}
function progress(
  practice: Practice,
  ladder: string,
  pool: readonly Round2Mission[],
) {
  const completed = practice.intentions.filter(
    (i) =>
      i.mission_id &&
      practice.checkIns.some(
        (c) => c.intention_id === i.id && c.outcome === "yes",
      ),
  );
  return Math.min(
    5,
    Math.max(
      1,
      ...completed
        .filter(
          (i) => pool.find((m) => m.id === i.mission_id)?.ladder === ladder,
        )
        .map((i) => (i.mission_step || 1) + 1),
    ),
  );
}

export function themeWeights(
  practice: Practice,
  priority: string,
  themes: string[],
  pool: readonly Round2Mission[] = catalogue,
) {
  const weights = Object.fromEntries(themes.map((theme) => [theme, 3]));
  const preference = practice.entries
    .filter(
      (e) =>
        e.kind === "preferences" &&
        e.title === "Priority theme" &&
        priorityName(e.meta.priority || "") === priorityName(priority),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (preference?.meta.theme && weights[preference.meta.theme] !== undefined)
    weights[preference.meta.theme] += 4;
  for (const intention of practice.intentions) {
    const mission = pool.find((m) => m.id === intention.mission_id);
    if (!mission || priorityName(intention.value) !== priorityName(priority))
      continue;
    const theme = missionTheme(mission, priority);
    if (!theme || weights[theme] === undefined) continue;
    weights[theme] += 1;
    const check = practice.checkIns.find(
      (c) => c.intention_id === intention.id,
    );
    if (check?.outcome === "yes") weights[theme] += 2;
    if (check?.energy === "lit" && check.outcome !== "not_yet")
      weights[theme] += 2;
    if (check?.outcome === "not_yet") weights[theme] -= 3;
  }
  for (const entry of practice.entries) {
    if (
      entry.kind !== "event" ||
      (entry.meta.outcome !== "passed" && entry.state !== "let_go")
    )
      continue;
    const mission = pool.find(
      (m) => m.id === entry.meta.mission_id || entry.source_ids.includes(m.id),
    );
    const theme =
      entry.meta.theme || (mission && missionTheme(mission, priority));
    if (
      theme &&
      weights[theme] !== undefined &&
      (!entry.meta.priority ||
        priorityName(entry.meta.priority) === priorityName(priority))
    )
      weights[theme] -= 2;
  }
  for (const theme of themes)
    weights[theme] = Math.max(1, Math.min(8, weights[theme]));
  return { weights, preference };
}

// Smooth weighted rotation is deterministic per local day and independent of size.
function rotatedTheme(
  practice: Practice,
  priority: string,
  themes: string[],
  day: string,
  pool: readonly Round2Mission[],
) {
  if (!themes.length) return undefined;
  if (themes.length === 1) return themes[0];
  const { weights, preference } = themeWeights(
    practice,
    priority,
    themes,
    pool,
  );
  const total = themes.reduce((sum, theme) => sum + weights[theme], 0);
  const current = Object.fromEntries(themes.map((theme) => [theme, 0]));
  const cycle: string[] = [];
  for (let index = 0; index < total * 2; index++) {
    for (const theme of themes) current[theme] += weights[theme];
    const chosen = themes
      .filter((theme) => theme !== cycle[cycle.length - 1])
      .sort((a, b) => current[b] - current[a] || a.localeCompare(b))[0];
    current[chosen] -= total;
    cycle.push(chosen);
  }
  // Avoid repeating across the cycle boundary as well.
  if (cycle[0] === cycle[cycle.length - 1]) cycle.pop();
  const anchor = preference?.meta.theme
    ? dayNumber(preference.updated_at.slice(0, 10))
    : 0;
  const index =
    (((dayNumber(day) - (Number.isFinite(anchor) ? anchor : 0)) %
      cycle.length) +
      cycle.length) %
    cycle.length;
  return cycle[index];
}

function emptySelection(
  options: MissionSelectionOptions,
  cleared = false,
): MissionSelection {
  return {
    mission: undefined,
    familyId: options.familyId,
    variants: {},
    availableLevels: [],
    unavailableReasons: {},
    effectiveWhere: cleared ? "anywhere" : options.where,
    effectiveKind: cleared ? "anywhere" : options.kind,
    whereCleared: cleared,
  };
}

export function selectMission(
  practice: Practice,
  options: MissionSelectionOptions,
): MissionSelection {
  const pool = options.pool || catalogue;
  return chooseFamily(
    practice,
    options,
    pool.filter((m) => !m.id.startsWith("SD-")),
  );
}

function chooseFamily(
  practice: Practice,
  options: MissionSelectionOptions,
  pool: readonly Round2Mission[],
  unscoped = false,
): MissionSelection {
  const now = options.now || new Date();
  const moment = missionLocalMoment(practice, now, options.day);
  const { day, weekend } = moment;
  const ages = savedKidsAges(practice);
  const reasons = new Map<string, string | undefined>();
  const reasonFor = (mission: Round2Mission) => {
    if (!reasons.has(mission.id))
      reasons.set(mission.id, unavailableAt(mission, ages, moment));
    return reasons.get(mission.id);
  };
  const priority = priorityName(options.priority);
  const strict = options.interest !== undefined || options.place !== undefined;
  const hasWhere = strict
    ? !!(options.interest || options.place)
    : options.kind === "place" || options.kind === "interest";
  if (!priority && !hasWhere && !unscoped) return emptySelection(options);
  const released = new Set(
    practice.entries
      .filter(
        (e) =>
          e.kind === "event" &&
          e.state === "let_go" &&
          dayNumber(day) - dayNumber(e.created_at.slice(0, 10)) < 14,
      )
      .flatMap((e) => [
        ...e.source_ids,
        ...(e.meta.mission_id ? [e.meta.mission_id] : []),
      ]),
  );
  const passedToday = new Map<string, number>();
  for (const entry of practice.entries) {
    if (entry.kind !== "event" || entry.meta.outcome !== "passed") continue;
    if (entry.meta.priority && priorityName(entry.meta.priority) !== priority)
      continue;
    const passedAt = new Date(entry.created_at);
    if (
      !Number.isFinite(passedAt.getTime()) ||
      missionLocalMoment(practice, passedAt).day !== day
    )
      continue;
    for (const id of [
      ...entry.source_ids,
      ...(entry.meta.mission_id ? [entry.meta.mission_id] : []),
    ]) {
      const mission = pool.find((item) => item.id === id);
      if (!mission) continue;
      const family = missionFamilyId(mission);
      passedToday.set(
        family,
        Math.max(passedToday.get(family) || 0, passedAt.getTime()),
      );
    }
  }
  const base = pool.filter(
    (m) =>
      m.active !== false &&
      m.type === (options.type || "do") &&
      !options.excludedFamilyIds?.includes(missionFamilyId(m)) &&
      !released.has(m.id) &&
      (!priority || m.priorities.some((p) => priorityName(p) === priority)),
  );
  const whereMatches = (m: Round2Mission) =>
    strict
      ? (!options.interest ||
          m.interests.some(
            (i) => normalise(i) === normalise(options.interest!),
          )) &&
        (!options.place ||
          normalise(options.place) === "anywhere" ||
          m.places.some((p) => normalise(p) === normalise(options.place!)))
      : options.kind === "interest"
        ? m.interests.some((i) => normalise(i) === normalise(options.where))
        : options.kind === "place"
          ? m.places.some((p) => normalise(p) === normalise(options.where))
          : true;
  const available = (m: Round2Mission) => !reasonFor(m);
  const exact = hasWhere ? base.filter(whereMatches) : base;
  const cleared = !strict && hasWhere && !exact.some(available) && !!priority;
  const candidates = cleared ? base : exact;
  const result = emptySelection(options, cleared);
  const groups = new Map<string, Round2Mission[]>();
  for (const mission of candidates) {
    const family = missionFamilyId(mission);
    groups.set(family, [...(groups.get(family) || []), mission]);
  }
  const preferredLevel = (rows: Round2Mission[]) =>
    LEVELS.map((level) => rows.find((m) => m.level === level)).find(Boolean)!;
  let families = [...groups.entries()].filter(([, rows]) =>
    rows.some(available),
  );
  if (options.familyId) {
    families = [...groups.entries()].filter(
      ([family]) => family === options.familyId,
    );
  } else {
    // Passing a card should actually show a different idea for every priority,
    // not only change the weights of broad healthy themes. Keep the context
    // exact, and cycle through the least-recently passed family if exhausted.
    const fresh = families.filter(([family]) => !passedToday.has(family));
    if (fresh.length) families = fresh;
    else if (families.length > 1) {
      const oldest = Math.min(
        ...families.map(([family]) => passedToday.get(family) || 0),
      );
      families = families.filter(
        ([family]) => passedToday.get(family) === oldest,
      );
    }
    // Anchor a family to its smallest eligible step, independent of the size
    // requested by the UI. Keep a real 5-minute starting point when available.
    if (
      families.some(([, rows]) =>
        rows.some((m) => m.level === "easy" && available(m)),
      )
    )
      families = families.filter(([, rows]) =>
        rows.some((m) => m.level === "easy" && available(m)),
      );
    const mainRank = (rows: Round2Mission[]) =>
      !priority ||
      priorityName(
        preferredLevel(rows.filter(available)).priorities[0] || "",
      ) === priority
        ? 0
        : 1;
    if (families.some(([, rows]) => mainRank(rows) === 0))
      families = families.filter(([, rows]) => mainRank(rows) === 0);
    const themes = [
      ...new Set(
        families
          .map(([, rows]) =>
            missionTheme(preferredLevel(rows.filter(available)), priority),
          )
          .filter((t): t is string => !!t),
      ),
    ].sort();
    const theme = rotatedTheme(practice, priority, themes, day, pool);
    if (theme)
      families = families.filter(
        ([, rows]) =>
          missionTheme(preferredLevel(rows.filter(available)), priority) ===
          theme,
      );
    families.sort(([idA, a], [idB, b]) => {
      const firstA = preferredLevel(a.filter(available));
      const firstB = preferredLevel(b.filter(available));
      const distanceA = Math.abs(
        firstA.ladder_step - progress(practice, firstA.ladder, pool),
      );
      const distanceB = Math.abs(
        firstB.ladder_step - progress(practice, firstB.ladder, pool),
      );
      const normalA = a.find((m) => m.level === "normal" && available(m));
      const normalB = b.find((m) => m.level === "normal" && available(m));
      const fitA = normalA ? (weekend || normalA.minutes >= 20 ? 0 : 1) : 2;
      const fitB = normalB ? (weekend || normalB.minutes >= 20 ? 0 : 1) : 2;
      return (
        fitA - fitB ||
        b.filter(available).length - a.filter(available).length ||
        distanceA - distanceB ||
        hash(`${day}:${idA}`) - hash(`${day}:${idB}`)
      );
    });
  }
  const chosen = families[0];
  if (!chosen) return result;
  result.familyId = chosen[0];
  const allFamilyRows = pool.filter((m) => missionFamilyId(m) === chosen[0]);
  for (const level of LEVELS) {
    const mission = chosen[1].find((m) => m.level === level);
    const reason = mission && reasonFor(mission);
    if (mission && !reason) result.variants[level] = mission;
    else if (reason) result.unavailableReasons[level] = reason;
    else if (allFamilyRows.some((m) => m.level === level))
      result.unavailableReasons[level] =
        "This size doesn’t fit your selection.";
    else
      result.unavailableReasons[level] =
        "This idea has no step in this size yet.";
  }
  result.availableLevels = LEVELS.filter((level) => !!result.variants[level]);
  result.mission = result.variants[options.level || "easy"];
  result.theme = missionTheme(preferredLevel(chosen[1]), priority);
  return result;
}

export function somedaySelection(
  practice: Practice,
  item: Someday,
  level: Level = "easy",
  options: Pick<MissionSelectionOptions, "now" | "day" | "familyId"> = {},
): MissionSelection {
  if (item.interest || item.priority) {
    const linked = selectMission(practice, {
      ...options,
      priority: item.priority || "",
      where: item.interest || "anywhere",
      kind: item.interest ? "interest" : "anywhere",
      level,
    });
    if (linked.familyId && linked.availableLevels.length) return linked;
  }
  const text = normalise(item.text);
  const code = /\b(visit|travel|see|trip)\b|walk.*camino|northern lights/.test(
    text,
  )
    ? "SEE"
    : /\b(buy|own|house|save|have)\b/.test(text)
      ? "HAV"
      : /\b(give|volunteer|help|share)\b/.test(text)
        ? "GIV"
        : /^(be |become)/.test(text)
          ? "BEC"
          : "LRN";
  const selection = chooseFamily(
    practice,
    {
      ...options,
      priority: "",
      where: "anywhere",
      kind: "anywhere",
      level,
    },
    catalogue.filter((m) => m.id.startsWith(`SD-${code}-`)),
    true,
  );
  for (const size of selection.availableLevels) {
    const mission = selection.variants[size]!;
    selection.variants[size] = {
      ...mission,
      mission_text: mission.mission_text.replaceAll(
        "[your someday]",
        item.text,
      ),
      first_step: mission.first_step.replaceAll("[your someday]", item.text),
    };
  }
  selection.mission = selection.variants[level];
  return selection;
}
