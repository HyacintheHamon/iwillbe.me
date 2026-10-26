import type { Practice } from "./domain";

export const PLANETS = [
  "Be",
  "People",
  "Causes",
  "Passions",
  "Grow",
  "Surprise",
] as const;
export type Planet = (typeof PLANETS)[number];
export type Energy = "lit" | "neutral" | "drained";
export type ValueChoice = "yes" | "not_sure" | "not_mine";
export type EntryKind =
  | "interest"
  | "value"
  | "strength"
  | "person"
  | "why"
  | "story"
  | "vision"
  | "review"
  | "question"
  | "backlog"
  | "preferences"
  | "event";
export type Entry = {
  id: string;
  kind: EntryKind;
  title: string;
  body: string;
  state: string;
  source: string;
  source_ids: string[];
  created_at: string;
  updated_at: string;
  meta: {
    planet?: Planet;
    planet_notes?: Partial<Record<Planet, string>>;
    answers?: (number | null)[];
    period?: string;
    version?: number;
    horizon?: "year" | "life";
    scores_visible?: boolean;
    analytics?: boolean;
    pace?: "stay" | "vary" | "guide";
    orbit?: Planet;
    passes?: number;
    next_day?: string;
    stopped?: boolean;
    step?: number;
    cursor?: number;
    sort?: Record<string, string>;
    blocks?: string[];
    last_comet_day?: string;
    last_comet_token?: string;
    lock?: boolean;
    morning_anchor?: string;
    evening_anchor?: string;
    last_asked_at?: string;
    last_asked_session?: string;
    last_check_in_at?: string;
    commitment_day?: string;
    category?: "practice";
    life_age?: 80 | 90 | 100;
    focus_area?: Planet;
    focus_until?: string;
    why_revisited_at?: string;
    previous_state?: string;
  };
};
export type EntryInput = Omit<Entry, "id" | "created_at" | "updated_at"> & {
  id?: string;
};
export function entryInput(
  kind: EntryKind,
  title: string,
  extra: Partial<EntryInput> = {},
): EntryInput {
  return {
    kind,
    title,
    body: "",
    state: "active",
    source: "Chosen by you",
    source_ids: [],
    meta: {},
    ...extra,
  };
}
export function entriesOf(p: Practice, kind: EntryKind) {
  return (p.entries || []).filter((e) => e.kind === kind);
}
export function currentWhy(p: Practice) {
  return entriesOf(p, "why")
    .filter((e) => e.state === "accepted")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
export function interestState(
  p: Practice,
  e: Entry,
): "Maybe" | "Tried it" | "Into it" | "On pause" | "All in" {
  if (["craft", "all_in"].includes(e.state)) return "All in";
  if (["ember", "paused"].includes(e.state)) return "On pause";
  const ids = new Set(
    p.intentions
      .filter((i) =>
        i.interest_id ? i.interest_id === e.id : i.interest === e.title,
      )
      .map((i) => i.id),
  );
  const experiences = p.checkIns.filter(
    (c) => ids.has(c.intention_id) && c.outcome !== "not_yet",
  );
  const lit = experiences.filter((c) => c.energy === "lit").length;
  if (["love", "into_it"].includes(e.state) || lit >= 2) return "Into it";
  return experiences.length || e.state === "tried" ? "Tried it" : "Maybe";
}
export function valueState(
  p: Practice,
  e: Entry,
): "Trying it on" | "Mine" | "Let go" {
  const ids = new Set(
    p.intentions
      .filter((i) => (i.value_id ? i.value_id === e.id : i.value === e.title))
      .map((i) => i.id),
  );
  const choices = p.checkIns
    .filter((c) => ids.has(c.intention_id) && c.value_choice)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (
    e.state === "let_go" &&
    (!choices[0] || e.updated_at >= choices[0].created_at)
  )
    return "Let go";
  if (
    e.state === "trying" &&
    (!choices[0] || e.updated_at >= choices[0].created_at)
  )
    return "Trying it on";
  if (
    e.state === "mine" &&
    (!choices[0] || e.updated_at >= choices[0].created_at)
  )
    return "Mine";
  if (choices[0]?.value_choice === "not_mine") return "Let go";
  return e.state === "mine" ||
    choices.filter((c) => c.value_choice === "yes").length >= 2
    ? "Mine"
    : "Trying it on";
}
export const REVIEW_QUESTIONS = [
  "How much did this month feel like your life, not one you were just going along with?",
  "How much did your days feel like they mattered this month?",
  "How connected did you feel to the people around you?",
];
export const STORIES = [
  "When did time disappear on you recently?",
  "What did you love doing as a kid?",
  "Who do you admire, and why?",
];
export const ENERGY_LABELS = {
  lit: "Lit me up",
  neutral: "Neutral",
  drained: "Drained me",
};
export function dayInZone(timezone: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
export function currentVision(p: Practice, horizon: "year" | "life") {
  return entriesOf(p, "vision")
    .filter((e) => e.meta.horizon === horizon)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
export function weekPeriod(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return `week:${d.toISOString().slice(0, 10)}`;
}
export function rhythmDue(p: Practice, now = new Date()) {
  const day = dayInZone(p.profile.timezone, now);
  const reviews = entriesOf(p, "review");
  const month = day.slice(0, 7);
  const completed = (period: string) =>
    reviews.some(
      (r) =>
        r.meta.period === period &&
        (r.state === "done" || (r.meta.next_day || "") > day),
    );
  const firstEvidence = [
    ...p.intentions.map((i) => i.created_at),
    ...p.entries.map((e) => e.created_at),
  ]
    .filter(Boolean)
    .sort()[0];
  // Do not turn a first visit into a monthly review. First Sunday remains an invitation.
  if (
    firstEvidence &&
    firstEvidence.slice(0, 7) < month &&
    !completed(`moon:${month}`)
  )
    return {
      kind: "monthly",
      period: `moon:${month}`,
      title: "Your monthly check-in",
      day,
    };
  const week = weekPeriod(day);
  if (new Date(`${day}T12:00:00Z`).getUTCDay() === 0 && !completed(week))
    return {
      kind: "weekly",
      period: week,
      title: "Sunday Explore · about ten minutes",
      day,
    };
  return null;
}
export function suggestedPlanet(p: Practice, day: string): Planet {
  const preferences = entriesOf(p, "preferences").find(
    (e) => e.title === "Season",
  );
  if (preferences?.meta.pace === "stay")
    return preferences.meta.orbit && preferences.meta.orbit !== "Surprise"
      ? preferences.meta.orbit
      : "Be";
  const picture = currentVision(p, "year");
  const pictureAreas = PLANETS.slice(0, 5).filter((area) =>
    picture?.meta.planet_notes?.[area]?.trim(),
  );
  const areas = pictureAreas.length ? pictureAreas : [...PLANETS.slice(0, 5)];
  const recent = p.intentions
    .filter(
      (i) =>
        i.day < day &&
        Date.parse(`${day}T12:00:00Z`) - Date.parse(`${i.day}T12:00:00Z`) <=
          7 * 86400000,
    )
    .sort((a, b) => b.day.localeCompare(a.day));
  const index = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
  const weeklyFocus = entriesOf(p, "preferences").find(
    (e) => e.title === "Weekly focus" && (e.meta.focus_until || "") >= day,
  )?.meta.focus_area;
  if (
    weeklyFocus &&
    weeklyFocus !== "Surprise" &&
    recent[0]?.planet !== weeklyFocus
  )
    return weeklyFocus;
  if (weeklyFocus && weeklyFocus !== "Surprise" && !areas.includes(weeklyFocus))
    areas.push(weeklyFocus);
  if (preferences?.meta.pace === "vary") {
    const choices = areas.length > 1 ? areas : [...PLANETS.slice(0, 5)];
    const candidates = choices.filter((area) => area !== recent[0]?.planet);
    return candidates[
      ((index % candidates.length) + candidates.length) % candidates.length
    ];
  }
  const rotated = [
    ...areas.slice(index % areas.length),
    ...areas.slice(0, index % areas.length),
  ];
  return rotated.sort(
    (a, b) =>
      recent.filter((i) => i.planet === a).length -
      recent.filter((i) => i.planet === b).length,
  )[0];
}
export const PLANET_OPENERS: Record<Planet, readonly string[]> = {
  Be: [
    "Who do you want to be today?",
    "What is one value you would like to try on today?",
    "How will you show up today?",
  ],
  People: [
    "Is there someone you’ve been meaning to reach out to?",
    "Who will you be today, and for whom?",
    "Who could use a little more of you today?",
  ],
  Causes: [
    "Is there a cause you could give a little time to this week?",
    "What is one small way you could help a cause you care about?",
  ],
  Passions: [
    "What’s something you’ve been curious to try?",
    "What would you happily make a little time for today?",
  ],
  Grow: [
    "What’s one small step on something you want to get better at?",
    "What would you like to practice today?",
  ],
  Surprise: [
    "What’s one thing you’ve been meaning to do?",
    "What sounds worth trying today?",
  ],
};
export const PLANET_PROMPTS = Object.fromEntries(
  Object.entries(PLANET_OPENERS).map(([area, openers]) => [area, openers[0]]),
) as Record<Planet, string>;

export function formatCommitment(
  action: string,
  kind: "action" | "be" = "action",
) {
  let words = action
    .trim()
    .replace(
      /^I\s+(?:will\s+try to|try to|want to|hope to|am going to|will)\s+/i,
      "",
    )
    .replace(/^I[’']ll\s+(?:try to\s+)?/i, "");
  if (kind === "be" && !/^be\b/i.test(words)) words = `be ${words}`;
  return words
    ? `I will ${words.charAt(0).toLowerCase()}${words.slice(1)}`
    : "I will";
}
export function returningToPractice(p: Practice, day: string) {
  const dates = [
    ...p.intentions.map((i) => i.created_at),
    ...p.checkIns.map((c) => c.created_at),
    ...p.messages.map((m) => m.created_at),
    ...p.entries
      .filter((e) => ["story", "review"].includes(e.kind))
      .map((e) => e.updated_at),
    ...entriesOf(p, "preferences")
      .filter((e) => e.title === "Check-in session")
      .map((e) => e.meta.last_check_in_at || ""),
  ]
    .filter(Boolean)
    .sort();
  const last = dates.at(-1);
  if (!last) return false;
  const lastDay = dayInZone(p.profile.timezone, new Date(last));
  return (
    Date.parse(`${day}T12:00:00Z`) - Date.parse(`${lastDay}T12:00:00Z`) >=
    3 * 86400000
  );
}
export function whyRevisitDue(p: Practice, day: string) {
  const reviews = entriesOf(p, "review")
    .filter((e) => e.meta.why_revisited_at)
    .map((e) => e.meta.why_revisited_at!);
  const started = [
    ...p.entries
      .filter((e) => e.kind === "why" || e.kind === "story")
      .map((e) => e.created_at),
    ...p.intentions.map((i) => i.created_at),
  ]
    .filter(Boolean)
    .sort()[0];
  const last = reviews.sort().at(-1) || started;
  if (!last) return false;
  const due = new Date(last);
  due.setUTCMonth(due.getUTCMonth() + 3);
  return day >= due.toISOString().slice(0, 10);
}
export function weeklyNotices(p: Practice, day: string) {
  const cutoff = Date.parse(`${day}T00:00:00Z`) - 6 * 86400000;
  const moments = p.intentions
    .filter((i) => i.day <= day && Date.parse(`${i.day}T12:00:00Z`) >= cutoff)
    .sort((a, b) => b.day.localeCompare(a.day));
  const notices: { text: string; sourceId: string }[] = [];
  const lit = moments.find((i) =>
    p.checkIns.some(
      (c) =>
        c.intention_id === i.id &&
        c.outcome !== "not_yet" &&
        c.energy === "lit",
    ),
  );
  if (lit)
    notices.push({ text: `“${lit.action}” lit you up.`, sourceId: lit.id });
  const person = moments.find(
    (i) =>
      i.person &&
      !/^(me|myself|for me)$/i.test(i.person) &&
      p.checkIns.some(
        (c) => c.intention_id === i.id && c.outcome !== "not_yet",
      ),
  );
  if (person)
    notices.push({
      text: `You showed up for ${person.person}: “${person.action}”.`,
      sourceId: person.id,
    });
  const released = entriesOf(p, "backlog").find(
    (e) => e.state === "released" && Date.parse(e.updated_at) >= cutoff,
  );
  if (released)
    notices.push({
      text: `You let go of “${released.title}”.`,
      sourceId: released.id,
    });
  if (notices.length < 2) {
    const value = moments.find(
      (i) =>
        i.value &&
        p.checkIns.some(
          (c) =>
            c.intention_id === i.id &&
            c.outcome !== "not_yet" &&
            c.value_choice === "yes",
        ),
    );
    if (value)
      notices.push({
        text: `You chose ${value.value.toLowerCase()} again.`,
        sourceId: value.id,
      });
  }
  return notices.slice(0, 3);
}
export function possibilityPattern(p: Practice) {
  const repeated = entriesOf(p, "interest")
    .filter((e) => e.meta.category !== "practice")
    .find((e) => {
      const ids = p.intentions
        .filter((i) =>
          i.interest_id ? i.interest_id === e.id : i.interest === e.title,
        )
        .map((i) => i.id);
      return (
        p.checkIns.filter(
          (c) =>
            ids.includes(c.intention_id) &&
            c.outcome !== "not_yet" &&
            c.energy === "lit",
        ).length >= 2
      );
    });
  if (repeated)
    return `${repeated.title} keeps lighting you up. Worth a closer look?`;
  const value = entriesOf(p, "value").find((e) => valueState(p, e) === "Mine");
  return value
    ? `${value.title} keeps showing up in your choices. Does it feel like yours?`
    : null;
}
export const WHY_QUESTIONS = [
  "What would you want to be remembered for?",
  "Who do you look up to, and what exactly about them?",
  "What were you doing the last time you lost track of time?",
  "Is there a quote or line that has stayed with you for years?",
  "What do you want more of in your life?",
  "What are you thankful for that you didn’t have to earn?",
  "What does your best ordinary day include?",
];
export function nextWhyQuestion(p: Practice, day: string) {
  const candidates = [
    ...WHY_QUESTIONS,
    "What’s one thing you did this week you’d happily do again?",
    "When did time disappear on you recently?",
  ];
  const start =
    Math.floor(Date.parse(`${day}T12:00:00Z`) / (7 * 86400000)) %
    WHY_QUESTIONS.length;
  const ordered = [...candidates.slice(start), ...candidates.slice(0, start)];
  return ordered.find((text) => questionAvailable(p, text, day)) || "";
}
export function questionAvailable(p: Practice, question: string, day: string) {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  return !entriesOf(p, "question").some(
    (e) =>
      normalize(e.title) === normalize(question) &&
      (e.state === "stopped" ||
        (e.meta.next_day || "") > day ||
        (!!e.meta.last_asked_at &&
          dayInZone(p.profile.timezone, new Date(e.meta.last_asked_at)) >=
            day)),
  );
}
