import type { CheckIn, Intention, Practice } from "./domain";
import { shiftDay } from "./domain";
import type { Possibility } from "./catalog";
import {
  currentWhy,
  dayInZone,
  entriesOf,
  interestState,
  formatCommitment,
  questionAvailable,
  type Planet,
} from "./journey";

export type Clue = {
  id: string;
  title: string;
  body: string;
  day: string;
  kind: string;
};

export function whyThreads(p: Practice) {
  const why = currentWhy(p);
  if (!why) return [];
  const sources = new Set(why.source_ids);
  const moments = p.intentions.filter(
    (i) =>
      sources.has(i.id) ||
      p.entries.some(
        (e) =>
          e.kind === "story" &&
          e.state === "active" &&
          (e.meta.period === `why-action:${i.day}` ||
            e.source_ids.includes(i.id)) &&
          e.source_ids.includes(why.id),
      ),
  );
  return p.entries.filter(
    (e) =>
      ["interest", "value", "strength"].includes(e.kind) &&
      !["let_go", "released", "paused", "on_pause", "ember"].includes(
        e.state,
      ) &&
      (sources.has(e.id) ||
        e.source_ids.some((id) => sources.has(id)) ||
        moments.some((i) =>
          e.kind === "interest"
            ? i.interest_id
              ? i.interest_id === e.id
              : i.interest === e.title
            : e.kind === "value" &&
              (i.value_id ? i.value_id === e.id : i.value === e.title),
        )),
  );
}

export function intentionConnectsToWhy(p: Practice, intention: Intention) {
  const why = currentWhy(p);
  if (!why) return false;
  return (
    why.source_ids.includes(intention.id) ||
    p.entries.some(
      (e) =>
        e.kind === "story" &&
        e.state === "active" &&
        e.meta.period === `why-action:${intention.day}` &&
        e.body === formatCommitment(intention.action, intention.kind) &&
        e.source_ids.includes(why.id),
    ) ||
    whyThreads(p).some((e) =>
      e.kind === "interest"
        ? intention.interest_id
          ? e.id === intention.interest_id
          : e.title === intention.interest
        : e.kind === "value" &&
          (intention.value_id
            ? e.id === intention.value_id
            : e.title === intention.value),
    )
  );
}

export function morningCue(p: Practice, day: string, area: Planet) {
  const yesterday = shiftDay(day, -1);
  const moment = p.intentions.find(
    (i) => i.day === yesterday && i.planet === area,
  );
  const reflection = p.checkIns.find((c) => c.intention_id === moment?.id);
  if (
    moment &&
    reflection?.outcome !== "not_yet" &&
    reflection?.energy === "lit" &&
    moment.interest
  ) {
    const question = `What would a small ${moment.interest.toLowerCase()} moment look like today?`;
    if (questionAvailable(p, question, day))
      return {
        line: `${moment.interest} lit you up yesterday.`,
        question,
        interest: moment.interest,
        value: "",
        sourceIds: [moment.id],
      };
  }
  const thread = whyThreads(p).find(
    (e) =>
      (e.meta.planet ||
        (e.kind === "value"
          ? "Be"
          : e.kind === "strength"
            ? "Grow"
            : "Passions")) === area,
  );
  if (!thread) return null;
  const question =
    thread.kind === "value"
      ? `How could you put ${thread.title.toLowerCase()} into practice today?`
      : `What is one small way to make room for ${thread.title.toLowerCase()} today?`;
  return questionAvailable(p, question, day)
    ? {
        line: `${thread.title} connects to a clue you chose for your why.`,
        question,
        interest: thread.kind === "interest" ? thread.title : "",
        value: thread.kind === "value" ? thread.title : "",
        sourceIds: [thread.id],
      }
    : null;
}

export function nightInsight(
  p: Practice,
  intention: Intention,
  reflection: Pick<CheckIn, "outcome" | "energy" | "value_choice">,
  day: string,
) {
  const last = entriesOf(p, "preferences").find(
    (e) => e.title === "Check-in session",
  )?.meta.last_insight_at;
  if (
    reflection.outcome === "not_yet" ||
    (last && dayInZone(p.profile.timezone, new Date(last)) > shiftDay(day, -7))
  )
    return null;
  const previous = p.intentions.filter(
    (i) =>
      i.day < intention.day &&
      i.day >= shiftDay(day, -30) &&
      i.action !== intention.action,
  );
  if (reflection.energy === "lit" && intention.interest) {
    const prior = previous.find(
      (i) =>
        (intention.interest_id
          ? i.interest_id === intention.interest_id
          : i.interest === intention.interest) &&
        p.checkIns.some(
          (c) =>
            c.intention_id === i.id &&
            c.outcome !== "not_yet" &&
            c.energy === "lit",
        ),
    );
    if (prior && prior.action.length <= 140)
      return {
        text: `${intention.interest} lit you up both today and when you chose “${prior.action}”.`,
        sourceIds: [prior.id, intention.id],
      };
  }
  if (
    reflection.value_choice === "yes" &&
    intention.value &&
    intention.person
  ) {
    const prior = previous.find(
      (i) =>
        i.value === intention.value &&
        i.person &&
        i.person !== intention.person &&
        p.checkIns.some(
          (c) =>
            c.intention_id === i.id &&
            c.outcome !== "not_yet" &&
            c.value_choice === "yes",
        ),
    );
    if (prior && prior.action.length <= 140)
      return {
        text: `You kept ${intention.value.toLowerCase()} after “${prior.action}”, and chose it again today.`,
        sourceIds: [prior.id, intention.id],
      };
  }
  return null;
}

export function weeklyPossibility(
  p: Practice,
  day: string,
  catalogue: readonly Pick<
    Possibility,
    "id" | "title" | "description" | "first" | "time" | "cost" | "related"
  >[] = [],
) {
  const cutoff = shiftDay(day, -6);
  const moments = p.intentions
    .filter(
      (i) =>
        i.day >= cutoff &&
        i.day <= day &&
        i.interest &&
        p.checkIns.some(
          (c) =>
            c.intention_id === i.id &&
            c.outcome !== "not_yet" &&
            c.energy === "lit",
        ),
    )
    .filter((i) => {
      const entry = entriesOf(p, "interest").find((e) =>
        i.interest_id ? e.id === i.interest_id : e.title === i.interest,
      );
      return !entry || interestState(p, entry) !== "On pause";
    })
    .sort((a, b) => b.day.localeCompare(a.day));
  const counts = (interest: string) =>
    moments.filter((i) => i.interest === interest).length;
  moments.sort((a, b) => counts(b.interest!) - counts(a.interest!));
  const lived = moments[0];
  if (!lived?.interest) return null;
  const source = catalogue.find(
    (item) => item.title.toLowerCase() === lived.interest!.toLowerCase(),
  );
  const adjacent =
    source &&
    catalogue.find(
      (item) =>
        source.related.includes(item.id) &&
        !entriesOf(p, "interest").some(
          (e) => e.title.toLowerCase() === item.title.toLowerCase(),
        ),
    );
  const related = moments.filter((i) => i.interest === lived.interest);
  return {
    title: adjacent?.title || lived.interest,
    description:
      adjacent?.description || `Another small moment with ${lived.interest}.`,
    reason:
      related.length > 1
        ? `${lived.interest} lit you up in different moments this week.`
        : `“${lived.action}” lit you up this week.`,
    first: adjacent?.first || lived.action,
    details: adjacent
      ? `${adjacent.time} · ${adjacent.cost}`
      : "Use the version you already know; make it smaller if you want.",
    sourceIds: related.map((i) => i.id),
    sourceTitle: lived.interest,
    planet: lived.planet,
  };
}

const areaWords: [Planet, RegExp][] = [
  [
    "Be",
    /\b(patient|patience|kind|kindness|brave|courage|fair|fairness|honest|honesty|present|presence|calm|calmer|values?)\b/i,
  ],
  [
    "People",
    /\b(friends?|family|sisters?|brothers?|parents?|children|kids|partner|neighbou?rs?|relationships?|grandparents?|aunt|uncle|daughter|son)\b/i,
  ],
  [
    "Causes",
    /\b(volunteer|volunteering|cause|community|climate|justice|environment|charity|advocacy)\b/i,
  ],
  [
    "Passions",
    /\b(outdoors?|nature|walking|hiking|draw|drawing|paint|painting|music|singing|dance|dancing|pottery|ceramics|read|reading|cook|cooking|garden|gardening|photography)\b/i,
  ],
  [
    "Grow",
    /\b(learn|learning|practice|practicing|study|studying|improve|better|skill|skills|grow|growth|language|french|spanish)\b/i,
  ],
];
export function proposeAreaMap(text: string): Partial<Record<Planet, string>> {
  // This is a reviewable sorting proposal, not saved meaning. Preserve the
  // person's words; only their confirmed map may guide their mornings.
  const fragments = text
    .split(/(?:[.!?;\n]+|,\s*|\s+and\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const proposed: Partial<Record<Planet, string>> = {};
  for (const [area, words] of areaWords) {
    const matches = fragments.filter((s) => words.test(s));
    if (matches.length) proposed[area] = matches.join("; ").slice(0, 600);
  }
  return proposed;
}

export function quarterStart(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const monthDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 3);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(monthDay, lastDay));
  return date.toISOString().slice(0, 10);
}
export function whyEvidence(
  p: Practice,
  day: string,
  revisiting: boolean,
): Clue[] {
  const cutoff = revisiting ? quarterStart(day) : "0000-01-01";
  const stories = entriesOf(p, "story")
    .filter((e) => {
      const date = dayInZone(p.profile.timezone, new Date(e.updated_at));
      return e.body.trim() && date >= cutoff && date <= day;
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      body: e.body,
      day: dayInZone(p.profile.timezone, new Date(e.updated_at)),
      kind: "story",
    }));
  const moments = p.intentions
    .filter((i) => i.day >= cutoff && i.day <= day)
    .flatMap((i) => {
      const reflection = p.checkIns.find((c) => c.intention_id === i.id);
      if (!reflection || reflection.outcome === "not_yet") return [];
      const kind =
        reflection.energy === "lit"
          ? "energy"
          : reflection.value_choice === "yes"
            ? "value"
            : i.person && !/^(me|myself|for me)$/i.test(i.person)
              ? "people"
              : "";
      if (!kind) return [];
      return [
        {
          id: i.id,
          title: i.action,
          body:
            kind === "energy"
              ? "It lit you up."
              : kind === "value"
                ? `You chose ${i.value.toLowerCase()}.`
                : `You showed up for ${i.person}.`,
          day: i.day,
          kind,
        },
      ];
    });
  return [...moments, ...stories].sort((a, b) => b.day.localeCompare(a.day));
}
export function featuredWhyEvidence(clues: Clue[]) {
  const featured: Clue[] = [];
  for (const kind of ["energy", "people", "value", "story"]) {
    const clue = clues.find(
      (c) => c.kind === kind && !featured.some((f) => f.id === c.id),
    );
    if (clue) featured.push(clue);
  }
  return featured.slice(0, 3);
}

export function sourceLabels(p: Practice, ids: string[]) {
  return ids
    .map(
      (id) =>
        p.entries.find((e) => e.id === id)?.title ||
        p.intentions.find((i) => i.id === id)?.action ||
        p.messages.find((m) => m.id === id && m.role === "user")?.content,
    )
    .filter((s): s is string => !!s);
}

export function newerPicturePossibility(p: Practice, horizon: "year" | "life") {
  if (horizon !== "year") return null;
  const picture = entriesOf(p, "vision")
    .filter((e) => e.meta.horizon === "year")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const recent = p.intentions.filter(
    (i) =>
      i.planet &&
      i.planet !== "Surprise" &&
      (!picture || i.created_at > picture.created_at) &&
      p.checkIns.some(
        (c) => c.intention_id === i.id && c.outcome !== "not_yet",
      ),
  );
  const example = recent.find(
    (i) =>
      !picture?.meta.planet_notes?.[i.planet!] &&
      recent.filter((other) => other.planet === i.planet).length >= 3,
  );
  return example ? { area: example.planet!, example: example.action } : null;
}
