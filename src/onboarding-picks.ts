import type { Entry } from "./journey";
import { quickPickState } from "./onboarding";

export type PickCard = {
  id: string;
  title: string;
  description: string;
  domain: string;
};
export type PickSnapshot = { id: string; updated_at: string };
export type PickChange = {
  card: PickCard;
  operation: "create" | "update" | "remove";
  state: "spark" | "love" | null;
  entry?: Entry;
};
export const pickSource = (state: "spark" | "love") =>
  state === "love" ? "Already love · chosen by you" : "Quick picks · curious";
export const pickKey = (id: string) => `pick:${id}`;

export function quickPickChanges(input: {
  cards: PickCard[];
  choices: Record<string, string>;
  entries: Entry[];
  session: string;
  snapshots: Record<string, PickSnapshot>;
  used: { interest_id?: string | null; interest?: string | null }[];
}): PickChange[] {
  const changes: PickChange[] = [];
  for (const card of input.cards) {
    const state = quickPickState(input.choices[card.id]);
    const owned = input.entries.find(
      (entry) =>
        entry.kind === "interest" &&
        entry.meta.onboarding_session === input.session &&
        entry.meta.onboarding_key === pickKey(card.id),
    );
    if (owned) {
      const snapshot = input.snapshots[card.id];
      // The person may already have put this into practice or edited it in
      // Possibilities. Returning to quick picks must not undo that later work.
      const changedElsewhere =
        snapshot &&
        (snapshot.id !== owned.id || snapshot.updated_at !== owned.updated_at);
      const used = input.used.some((intention) =>
        intention.interest_id
          ? intention.interest_id === owned.id
          : intention.interest?.toLowerCase() === owned.title.toLowerCase(),
      );
      const stillAPick =
        ["spark", "love"].includes(owned.state) &&
        owned.title === card.title &&
        owned.body === card.description &&
        [pickSource("spark"), pickSource("love")].includes(owned.source);
      if (used || changedElsewhere || !stillAPick) continue;
      if (!state)
        changes.push({ card, operation: "remove", state, entry: owned });
      else if (state !== owned.state)
        changes.push({ card, operation: "update", state, entry: owned });
      continue;
    }
    const alreadyKnown = input.entries.some(
      (entry) =>
        entry.kind === "interest" &&
        entry.title.trim().toLowerCase() === card.title.trim().toLowerCase(),
    );
    if (state && !alreadyKnown)
      changes.push({ card, operation: "create", state });
  }
  return changes;
}

// Older unfinished onboarding sessions have no ownership metadata. Adopt only
// entries whose exact old source, choice and content identify this saved pick.
// Completed first sessions and interests used since then remain untouched.
export function legacyPickOwnership(input: {
  cards: PickCard[];
  choices: Record<string, string>;
  entries: Entry[];
  onboarded: boolean;
  used: { interest_id?: string | null; interest?: string | null }[];
}) {
  if (input.onboarded) return [];
  return input.cards.flatMap((card) => {
    const state = quickPickState(input.choices[card.id]);
    if (!state) return [];
    const entry = input.entries.find(
      (entry) =>
        entry.kind === "interest" &&
        !entry.meta.onboarding_session &&
        entry.title === card.title &&
        entry.body === card.description &&
        entry.state === state &&
        entry.source === pickSource(state),
    );
    if (
      !entry ||
      input.used.some((i) =>
        i.interest_id
          ? i.interest_id === entry.id
          : i.interest?.toLowerCase() === entry.title.toLowerCase(),
      )
    )
      return [];
    return [{ card: card.id, id: entry.id, updated_at: entry.updated_at }];
  });
}
