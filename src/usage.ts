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
    | "review_saved",
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
