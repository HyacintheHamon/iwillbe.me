import type { Practice } from "./domain";
import { entryInput } from "./journey";

export function nightCompletionMarker(practice: Practice, day: string) {
  const existing = practice.entries.find(
    (entry) =>
      entry.kind === "event" &&
      entry.title === "Night check-in completed" &&
      entry.meta.commitment_day === day,
  );
  return entryInput("event", "Night check-in completed", {
    ...existing,
    body: "",
    state: "done",
    source: "Night check-in",
    source_ids: [],
    meta: { commitment_day: day },
  });
}
