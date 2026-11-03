export type NightThought = {
  id: number;
  format: "quote" | "story" | "reframe";
  text: string;
  person: string;
  source: string;
  credit: string;
  preface?: string;
  priorities: string[];
  traditions: string[];
  once_only: boolean;
  status: string;
};
export type ThoughtHistory = {
  thought_id: number | null;
  shown_at: string;
  snapshot: NightThought | null;
};
export function shortlistThoughts(
  all: NightThought[],
  history: ThoughtHistory[],
  working: string[],
  important: string[],
  faith: string | null,
  now = new Date(),
): NightThought[] {
  const cutoff = now.getTime() - 180 * 86400000;
  const last = [...history].sort((a, b) =>
    b.shown_at.localeCompare(a.shown_at),
  )[0];
  const hasFaith = [...working, ...important].includes("guided by faith");
  const eligible = all.filter(
    (t) =>
      t.status === "verified" &&
      !history.some(
        (h) =>
          h.thought_id === t.id &&
          (t.once_only || Date.parse(h.shown_at) >= cutoff),
      ) &&
      (!t.person || t.person !== last?.snapshot?.person) &&
      (!t.priorities.includes("guided by faith") ||
        (hasFaith &&
          !!faith &&
          faith !== "Prefer not to say" &&
          (faith === "Spiritual, from many traditions" ||
            t.traditions.includes(faith)))),
  );
  const score = (t: NightThought) =>
    t.priorities.reduce(
      (sum, p) =>
        sum + (working.includes(p) ? 4 : important.includes(p) ? 1 : 0),
      0,
    );
  return eligible
    .sort((a, b) => score(b) - score(a) || a.id - b.id)
    .slice(0, 10);
}
