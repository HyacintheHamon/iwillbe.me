import type { Practice } from "./domain";
import { supabase } from "./supabase";
export function recordUsage(
  practice: Practice,
  owner: string | undefined,
  event:
    | "session_started"
    | "activation"
    | "intention_saved"
    | "reflection_saved"
    | "review_saved"
    | "my_map_opened"
    | "future_me_opened"
    | "sunday_review_opened",
) {
  if (
    !owner ||
    !practice.entries.some(
      (e) =>
        e.kind === "preferences" && e.title === "Privacy" && e.meta.analytics,
    )
  )
    return;
  // A metrics failure must never block or change the user's saved practice.
  void supabase
    .from("product_events")
    .insert({ user_id: owner, event })
    .then(
      () => {},
      () => {},
    );
}

// Screen names only; preserve the existing explicit analytics opt-in.
export function recordScreenVisit(
  practice: Practice,
  owner: string | undefined,
  screen: "my_map" | "future_me" | "sunday_review",
) {
  const events = {
    my_map: "my_map_opened",
    future_me: "future_me_opened",
    sunday_review: "sunday_review_opened",
  } as const;
  recordUsage(practice, owner, events[screen]);
}
