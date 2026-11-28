import type { Entry, EntryInput } from "./journey";
import { entryInput } from "./journey";
import { PRIORITY_WORDS, QUICK_PICKS, priorityName } from "./priorities";
import type { KidsAge } from "./round3-preference-rules";

export const ONBOARDING_VERSION = "one-minute-v1";
export const ONBOARDING_PRIORITY_COUNT = 7;
export const ONBOARDING_PEOPLE = [
  ["my kids", "with my kids"],
  ["my partner", "with my partner"],
  ["my parents", "with my parents"],
  ["friends", "with friends"],
  ["my team", "with my team"],
  ["my community", "in my community"],
  ["myself", "for myself"],
] as const;
export const ONBOARDING_STEP_NAMES = [
  "Welcome",
  "Priorities",
  "Interests",
  "People",
  "The why",
] as const;

export type OneMinuteOnboardingDraft = {
  step: number;
  priorities: string[];
  interests: string[];
  customInterests: string;
  who: string[];
  customWho: string;
  kidsAges: KidsAge[];
  faith: string;
  why: string;
  entryIds: Record<string, string>;
  createdPlaceIds: Record<string, string>;
};

const normalise = (value: string) => value.trim().toLocaleLowerCase();
const uniqueWords = (values: string[]) => {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = normalise(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export function toggleOnboardingPick<T extends string>(
  selected: T[],
  value: T,
  maximum = Number.POSITIVE_INFINITY,
): T[] {
  if (selected.includes(value))
    return selected.filter((item) => item !== value);
  return selected.length < maximum ? [...selected, value] : selected;
}

/** These are literal choices, not inferred interests from a longer story. */
export function customOnboardingWords(text: string) {
  return uniqueWords(text.split(/[,;\n]+/));
}

export function selectedOnboardingInterests(
  draft: Pick<OneMinuteOnboardingDraft, "interests" | "customInterests">,
) {
  return uniqueWords([
    ...draft.interests.filter((name) =>
      QUICK_PICKS.some((pick) => pick.title === name),
    ),
    ...customOnboardingWords(draft.customInterests),
  ]);
}

export function selectedOnboardingPlaces(
  draft: Pick<OneMinuteOnboardingDraft, "who" | "customWho">,
) {
  return uniqueWords([
    ...draft.who.filter((label) =>
      ONBOARDING_PEOPLE.some(([, place]) => place === label),
    ),
    ...customOnboardingWords(draft.customWho).map((label) =>
      /^(with|for|in|at)\s/i.test(label) ? label : `with ${label}`,
    ),
  ]);
}

export function validFirstWhy(text: string) {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  return words.length >= 3 && text.trim().length <= 6000;
}

export function validOnboardingPriorities(priorities: string[]) {
  return (
    priorities.length === ONBOARDING_PRIORITY_COUNT &&
    new Set(priorities).size === ONBOARDING_PRIORITY_COUNT &&
    priorities.every((name) =>
      PRIORITY_WORDS.some((word) => word.name === name),
    )
  );
}

export function isOneMinuteOnboardingEntry(entry: Entry) {
  return entry.meta.onboarding_session === ONBOARDING_VERSION;
}

/**
 * Only this session's own records are reconciled on a retry. A previous map,
 * accepted why or imported record is never removed when a chip is unticked.
 */
export function onboardingEntriesToRemove(
  entries: Entry[],
  desired: EntryInput[],
) {
  const keep = new Set(desired.map((entry) => entry.meta.onboarding_key));
  return entries.filter(
    (entry) =>
      isOneMinuteOnboardingEntry(entry) &&
      (["value", "interest", "why"].includes(entry.kind) ||
        (entry.kind === "preferences" && entry.title === "Kids ages")) &&
      !keep.has(entry.meta.onboarding_key),
  );
}

export function onboardingEntryPlan(
  draft: OneMinuteOnboardingDraft,
  entries: Entry[],
): EntryInput[] {
  if (!validOnboardingPriorities(draft.priorities))
    throw new Error("Choose exactly seven priorities to begin.");
  if (!validFirstWhy(draft.why))
    throw new Error("Write at least three words for your first why.");
  const make = (
    kind: EntryInput["kind"],
    title: string,
    fields: Partial<EntryInput>,
  ) => {
    const key = `${kind}:${normalise(title)}`;
    const existing = entries.find((entry) => {
      if (entry.kind !== kind) return false;
      if (kind === "why")
        return (
          isOneMinuteOnboardingEntry(entry) && entry.meta.onboarding_key === key
        );
      return kind === "value"
        ? priorityName(entry.title) === title
        : normalise(entry.title) === normalise(title);
    });
    const ownsEntry = !existing || isOneMinuteOnboardingEntry(existing);
    return entryInput(kind, title, {
      ...existing,
      ...fields,
      id: existing?.id || draft.entryIds[key],
      revision: existing?.revision,
      meta: {
        ...existing?.meta,
        ...fields.meta,
        ...(ownsEntry
          ? {
              onboarding_session: ONBOARDING_VERSION,
              onboarding_key: key,
            }
          : {}),
      },
    });
  };
  const result: EntryInput[] = draft.priorities.map((name) =>
    make("value", name, {
      state: "working_on",
      source: "Chosen in Start your map",
      meta: {
        priority_group: PRIORITY_WORDS.find((word) => word.name === name)
          ?.group,
      },
    }),
  );
  result.push(
    ...selectedOnboardingInterests(draft).map((name) =>
      make("interest", name, {
        state: "want_to_try",
        source: "Chosen in Start your map",
      }),
    ),
  );
  if (draft.who.includes("with my kids"))
    result.push(
      make("preferences", "Kids ages", {
        body: draft.kidsAges.join(", "),
        source: draft.kidsAges.length
          ? "Chosen in Start your map"
          : "Left open in Start your map",
        meta: { ages: draft.kidsAges, asked: true },
      }),
    );
  result.push(
    make("why", "My why", {
      body: draft.why.trim(),
      state: "accepted",
      source: "Your first draft",
    }),
  );
  return result;
}
