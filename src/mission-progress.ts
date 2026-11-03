import type { Entry } from "./journey";
import type { Practice } from "./domain";
export function ladderStep(data: Practice, entry: Entry) {
  // Derive from completed distinct mission days: edits/retries never increment twice.
  const done = data.intentions.filter(
    (i) =>
      i.interest_id === entry.id &&
      i.mission_id &&
      data.checkIns.some((c) => c.intention_id === i.id && c.outcome === "yes"),
  );
  return Math.min(
    5,
    Math.max(
      1,
      entry.meta.ladder_step || 1,
      ...done.map((i) => (i.mission_step || 1) + 1),
    ),
  );
}
