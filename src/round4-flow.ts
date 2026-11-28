import type { Intention, Outcome, Practice } from "./domain";
import { shiftDay } from "./domain";
import {
  entryInput,
  interestState,
  returningToPractice,
  valueState,
  type Entry,
} from "./journey";
import { priorityName, PRIORITY_WORDS } from "./priorities";
import {
  MISSIONS,
  isHardDay,
  missionFamilyId,
  priorityOptions,
  selectMission,
  type Place,
  type Summary,
  type Round2Mission,
} from "./round2";
import { missionUnavailableReason } from "./mission-selection";
import { localHour, pendingFromMission, type PendingFocus } from "./today-flow";
import { missionSignals, missionRecommendationPool } from "./mission-feedback";
import {
  recommendationProfile,
  recommendationRank,
  suggestionHash,
} from "../supabase/functions/_shared/mission-recommendations";

export const OBSTACLES = [
  {
    id: "time",
    label: "Ran out of time",
    reply: "Busy days happen. Want a 5-minute version for tomorrow?",
  },
  {
    id: "start",
    label: "Didn't know where to start",
    reply:
      "That's often the hardest part. What's the very first thing you'd touch?",
  },
  {
    id: "big",
    label: "Felt too big",
    reply: "Let's shrink it. What piece could you do in 10 minutes?",
  },
  {
    id: "motivation",
    label: "Not feeling it",
    reply:
      "Fair enough. Is it still something you want, or is it okay to let it go?",
  },
  {
    id: "unexpected",
    label: "Something came up",
    reply: "Life got a vote today. Same plan tomorrow, or a plan B?",
  },
  { id: "unsure", label: "Not sure", reply: "That's okay. Sleep on it." },
] as const;
export type ObstacleReason = (typeof OBSTACLES)[number]["id"];
export type TodayIdea = {
  id: string;
  label: string;
  stage: string;
  kind: "priority" | "interest" | "reminder" | "meaning_to";
  text: string;
  minutes?: number;
  pending: PendingFocus;
  entryId?: string;
  suggestedInterest?: string;
};

/** Typed words keep their case. Only library actions are adapted into a sentence. */
export function focusSentence(
  focus: Pick<Intention, "action" | "source" | "kind" | "value">,
) {
  const text = focus.action.trim();
  if (/^I\s+will\b|^I['’]ll\b/i.test(text)) return text;
  let words = text;
  const priority = priorityName(focus.value);
  if (
    focus.kind === "be" ||
    (focus.source === "suggested" &&
      priority &&
      words.toLowerCase().startsWith(priority))
  ) {
    if (!/^be\b/i.test(words)) words = `be ${words}`;
  } else if (focus.source === "suggested" && !/^I\b/.test(words)) {
    words = words.charAt(0).toLowerCase() + words.slice(1);
  }
  return words ? `I will ${words}` : "I will";
}

export function focusKey(focus: Pick<Intention, "action" | "mission_id">) {
  return focus.mission_id
    ? `mission:${missionFamilyId(focus.mission_id)}`
    : `typed:${focus.action
        .trim()
        .replace(/^I\s+will\s+/i, "")
        .replace(/\s+/g, " ")
        .replace(/[.!?]+$/, "")
        .toLowerCase()}`;
}

export function pendingFromEntry(entry: Entry): PendingFocus {
  const mission =
    MISSIONS.find((m) => m.id === entry.meta.mission_id) ||
    entry.meta.mission_snapshot;
  const context = {
    text: entry.body || entry.title,
    priority: entry.meta.priority || "",
    interest: entry.meta.interest || "",
    place: entry.meta.place || "",
  };
  return mission
    ? pendingFromMission(mission, context)
    : {
        ...context,
        source: entry.meta.mission_id ? "suggested" : "typed",
        missionId: entry.meta.mission_id || null,
        missionStep: null,
        level: entry.meta.level || null,
        type: "do",
        somedayId: null,
      };
}

export function tomorrowPrefill(practice: Practice, day: string) {
  return practice.entries
    .filter(
      (entry) =>
        entry.kind === "preferences" &&
        entry.title === "Tomorrow focus" &&
        entry.meta.reminder_day === day &&
        entry.meta.prefill &&
        entry.meta.status === "open",
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

export function todayIdeas(
  practice: Practice,
  places: Place[],
  day: string,
  now: Date,
  summary?: Summary,
  includeLearning = false,
): TodayIdea[] {
  const result: TodayIdea[] = [];
  const families = new Set<string>();
  const texts = new Set<string>();
  const append = (idea: TodayIdea) => {
    const text = idea.text.trim().toLowerCase();
    const family = idea.pending.missionId
      ? missionFamilyId(idea.pending.missionId)
      : undefined;
    if (!text || texts.has(text) || (family && families.has(family))) return;
    texts.add(text);
    if (family) families.add(family);
    result.push(idea);
  };
  const reminders = practice.entries
    .filter(
      (entry) =>
        entry.kind === "preferences" &&
        entry.title === "Action reminder" &&
        entry.meta.status === "open" &&
        !!entry.meta.reminder_day &&
        entry.meta.reminder_day <= day,
    )
    .sort(
      (a, b) =>
        Number(b.meta.created_from === "night_obstacle") -
          Number(a.meta.created_from === "night_obstacle") ||
        b.created_at.localeCompare(a.created_at),
    );
  for (const entry of reminders) {
    const pending = pendingFromEntry(entry);
    if (
      pending.missionSnapshot &&
      missionUnavailableReason(pending.missionSnapshot, practice, now, day)
    )
      continue;
    append({
      id: entry.id,
      label: "Your reminder",
      stage:
        entry.meta.created_from === "night_obstacle"
          ? "A smaller step for today"
          : "Saved by you",
      kind: "reminder",
      text: pending.text,
      minutes: pending.missionSnapshot?.minutes,
      pending,
      entryId: entry.id,
    });
  }
  if (!returningToPractice(practice, day) && !summary?.hard_day) {
    const opener = summary?.opener_line;
    const backlog = opener?.item_id
      ? practice.entries.find(
          (e) =>
            e.id === opener.item_id && ["open", "active"].includes(e.state),
        )
      : practice.entries.find(
          (e) =>
            e.kind === "backlog" &&
            ["open", "active"].includes(e.state) &&
            (!e.meta.next_day || e.meta.next_day <= day),
        );
    const text =
      opener?.kind !== "meaning_to"
        ? opener?.focus_text
        : backlog?.body || backlog?.title;
    const item =
      backlog && (!text || opener?.kind === "meaning_to") ? backlog : undefined;
    const words = text || item?.body || item?.title;
    if (words) {
      const mission = MISSIONS.find((m) => m.id === opener?.mission_id);
      if (!mission || !missionUnavailableReason(mission, practice, now, day))
        append({
          id: `opener:${day}`,
          label: item ? "Meaning to" : "From last night",
          stage: "One idea to consider",
          kind: item ? "meaning_to" : "reminder",
          text: words,
          entryId: item?.id,
          pending: mission
            ? pendingFromMission(mission, { text: words })
            : {
                text: words,
                source: "typed",
                priority: "",
                interest: "",
                place: "",
                missionId: null,
                missionStep: null,
                level: null,
                type: "do",
                somedayId: null,
              },
        });
    }
  }
  const preferences = recommendationProfile(
    missionSignals(practice),
    missionRecommendationPool(practice, MISSIONS),
    day,
  );
  const priorities = priorityOptions(practice).sort(
    (a, b) =>
      suggestionHash(`${day}:priority:${a}`) -
      suggestionHash(`${day}:priority:${b}`),
  );
  const orderedPlaces = places
    .slice()
    .sort(
      (a, b) =>
        recommendationRank(
          a.label,
          day,
          -(preferences.recentPlaces.get(a.label.toLowerCase()) || 0),
        ) -
        recommendationRank(
          b.label,
          day,
          -(preferences.recentPlaces.get(b.label.toLowerCase()) || 0),
        ),
    );
  const interests = practice.entries
    .filter(
      (entry) =>
        entry.kind === "interest" &&
        interestState(practice, entry) !== "On pause",
    )
    .sort(
      (a, b) =>
        recommendationRank(
          a.title,
          day,
          preferences.interest.get(a.title.toLowerCase()) || 0,
        ) -
        recommendationRank(
          b.title,
          day,
          preferences.interest.get(b.title.toLowerCase()) || 0,
        ),
    );
  const contexts: { priority: string; interest: string; stage: string }[] = [];
  for (
    let index = 0;
    index < Math.max(priorities.length, interests.length);
    index++
  ) {
    if (priorities[index]) {
      const entry = practice.entries.find(
        (e) =>
          e.kind === "value" && priorityName(e.title) === priorities[index],
      );
      contexts.push({
        priority: priorities[index],
        interest: "",
        stage: entry ? valueState(practice, entry) : "Working on",
      });
    }
    if (interests[index])
      contexts.push({
        priority: "",
        interest: interests[index].title,
        stage: interestState(practice, interests[index]),
      });
  }
  let libraryCount = 0;
  for (const context of contexts) {
    if (libraryCount >= 9) break;
    const place = context.interest
      ? ""
      : orderedPlaces[libraryCount % Math.max(1, orderedPlaces.length)]
          ?.label || "";
    let selection = selectMission(practice, {
      priority: context.priority,
      where: context.interest || place || "anywhere",
      kind: context.interest ? "interest" : place ? "place" : "anywhere",
      level: "easy",
      now,
      day,
      excludedFamilyIds: [...families],
      type: includeLearning && libraryCount === 2 ? "learn" : "do",
    });
    if (!selection.mission && includeLearning && libraryCount === 2)
      selection = selectMission(practice, {
        priority: context.priority,
        where: context.interest || place || "anywhere",
        kind: context.interest ? "interest" : place ? "place" : "anywhere",
        level: "easy",
        now,
        day,
        excludedFamilyIds: [...families],
      });
    const mission = selection.mission;
    if (!mission) {
      // Keep a newly named interest visible while its saved, private mission is
      // generated by the existing Chloe endpoint. No invented library record.
      if (context.interest)
        append({
          id: `custom:${context.interest}`,
          label: context.interest,
          stage: context.stage,
          kind: "interest",
          text: `Find a first step in ${context.interest}`,
          suggestedInterest: context.interest,
          pending: {
            text: "",
            source: "suggested",
            priority: "",
            interest: context.interest,
            place: "",
            missionId: null,
            missionStep: null,
            level: null,
            type: "do",
            somedayId: null,
          },
        });
      continue;
    }
    append({
      id: mission.id,
      label: context.interest || `iwillbe.${context.priority}`,
      stage: context.stage,
      kind: context.interest ? "interest" : "priority",
      text: mission.mission_text,
      minutes: mission.minutes,
      pending: pendingFromMission(mission, {
        priority: context.priority,
        interest: context.interest,
        place: selection.whereCleared ? "" : place,
      }),
    });
    libraryCount++;
  }
  return result;
}

export function shouldAskObstacle(
  practice: Practice,
  focus: Intention,
  outcome: Outcome | undefined,
  day: string,
  note = "",
) {
  if (!outcome || outcome === "yes" || isHardDay(note) || focus.day !== day)
    return false;
  // Leave a quiet night between prompts, even when the user changes focus.
  // This also covers the stricter rule for the same family on adjacent nights.
  return !practice.entries.some(
    (entry) =>
      entry.kind === "event" &&
      entry.title === "Night obstacle" &&
      entry.meta.asked &&
      entry.meta.focus_day === shiftDay(day, -1),
  );
}

export function obstacleEvent(
  practice: Practice,
  focus: Intention,
  day: string,
) {
  const existing = practice.entries.find(
    (entry) =>
      entry.kind === "event" &&
      entry.title === "Night obstacle" &&
      entry.meta.focus_day === day &&
      entry.meta.intention_id === focus.id &&
      entry.meta.focus_key === focusKey(focus),
  );
  return entryInput("event", "Night obstacle", {
    ...existing,
    source: "Private night reflection",
    source_ids: [focus.id],
    meta: {
      ...existing?.meta,
      asked: true,
      focus_key: focusKey(focus),
      focus_day: day,
      intention_id: focus.id,
      priority: focus.value,
      interest: focus.interest || "",
      place: focus.place || "",
      next_day: shiftDay(day, 1),
    },
  });
}

export function stalledFocuses(practice: Practice, focus: Intention) {
  return practice.intentions.filter(
    (intention) =>
      intention.day <= focus.day &&
      focusKey(intention) === focusKey(focus) &&
      practice.checkIns.some(
        (check) =>
          check.intention_id === intention.id && check.outcome !== "yes",
      ),
  ).length;
}

export function obstaclePlan(
  practice: Practice,
  focus: Intention,
  reason: ObstacleReason,
  note: string,
  day: string,
  privateFamily: Round2Mission[] = [],
) {
  const descriptor = OBSTACLES.find((item) => item.id === reason)!;
  const familyPool = [...MISSIONS, ...privateFamily];
  const source = familyPool.find((mission) => mission.id === focus.mission_id);
  const stallCount =
    stalledFocuses(practice, focus) +
    (practice.checkIns.some((c) => c.intention_id === focus.id) ? 0 : 1);
  const tomorrow = shiftDay(day, 1);
  // Eligibility is evaluated for the next local morning, not tonight's hour.
  const target = new Date(`${tomorrow}T09:00:00Z`);
  target.setUTCHours(
    target.getUTCHours() + 9 - localHour(practice.profile.timezone, target),
  );
  const sameEasy =
    source &&
    familyPool.find(
      (mission) =>
        missionFamilyId(mission) === missionFamilyId(source) &&
        mission.level === "easy" &&
        !missionUnavailableReason(mission, practice, target, tomorrow),
    );
  const otherPerson =
    /\b(kids?|child|children|partner|wife|husband|friend|colleague|coworker|co-worker|parent|team|family)\b/i.test(
      note,
    );
  const ladders = otherPerson
    ? ["Solving it together"]
    : reason === "unexpected"
      ? ["Rolling with change"]
      : reason === "start"
        ? ["Starting now", "Getting unstuck"]
        : ["Getting unstuck", "Starting now", "Rolling with change"];
  const pool = MISSIONS.filter((mission) => ladders.includes(mission.ladder));
  const replacement =
    selectMission(practice, {
      priority: "",
      where: "anywhere",
      kind: "anywhere",
      level: "easy",
      day: tomorrow,
      now: target,
      pool,
      place: "anywhere",
    }).mission ||
    pool.find(
      (m) =>
        m.level === "easy" &&
        !missionUnavailableReason(m, practice, target, tomorrow),
    );
  const needsDifferentSkill =
    stallCount >= 3 || otherPerson || reason === "unexpected";
  const limit = reason === "big" ? 10 : 5;
  const mission = needsDifferentSkill
    ? replacement
    : reason !== "start" && sameEasy && sameEasy.minutes <= limit
      ? sameEasy
      : undefined;
  const original = focus.action.trim().replace(/^I\s+will\s+/i, "");
  // Before repeated stalls, shrink the person's actual focus. A random skill
  // ladder is not a five-minute version of their chosen action.
  const smaller =
    reason === "start"
      ? source?.first_step ||
        `Choose the first thing you would touch to begin: ${original}`
      : reason === "big"
        ? `Spend ten minutes on one small piece of: ${original}`
        : `Spend five minutes on one small part of: ${original}`;
  const text =
    reason === "unsure" || reason === "motivation"
      ? ""
      : mission?.mission_text || smaller;
  return {
    reply: descriptor.reply,
    stuck: stallCount >= 3,
    stuckLine:
      "This one keeps getting stuck. That usually means the step is the wrong size, not that anything's wrong with you.",
    text: text.length > 500 ? `${text.slice(0, 499)}…` : text,
    mission: text ? mission : undefined,
  };
}

export function priorityReviewDue(practice: Practice, focus: Intention) {
  if (!focus.value) return false;
  const trials = practice.intentions.filter(
    (i) =>
      priorityName(i.value) === priorityName(focus.value) &&
      i.day <= focus.day &&
      (i.id === focus.id ||
        practice.checkIns.some((c) => c.intention_id === i.id)),
  );
  const value = practice.entries.find(
    (e) =>
      e.kind === "value" && priorityName(e.title) === priorityName(focus.value),
  );
  return (
    trials.length > 0 &&
    trials.length % 5 === 0 &&
    value?.meta.value_review_day !== focus.day
  );
}

export function inferredInterest(practice: Practice, focus: Intention) {
  let interest = focus.interest?.trim() || "";
  if (!interest) {
    const action = focus.action.toLowerCase();
    if (/\bsalsa\b/.test(action)) interest = "salsa dancing";
    else
      interest =
        [...new Set(MISSIONS.flatMap((mission) => mission.interests))]
          .sort((a, b) => b.length - a.length)
          .find(
            (label) => label.length > 3 && action.includes(label.toLowerCase()),
          ) || "";
  }
  if (
    !interest ||
    PRIORITY_WORDS.some((p) => p.name === interest.toLowerCase()) ||
    practice.entries.some(
      (e) =>
        e.kind === "interest" &&
        e.title.toLowerCase() === interest.toLowerCase(),
    )
  )
    return "";
  return interest;
}
