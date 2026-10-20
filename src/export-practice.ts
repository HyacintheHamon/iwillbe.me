import type { Practice } from "./domain";
import { supabase } from "./supabase";

// Export every owned row, not just the recent conversation loaded by the UI.
export async function exportPractice(local: Practice, owner?: string) {
  if (!owner) return { exported_at: new Date().toISOString(), ...local };
  const allRows = async (table: string, key = "id") => {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", owner)
        .order(key)
        .range(offset, offset + 999);
      if (error)
        throw new Error(
          "Could not export your complete practice. Please try again.",
        );
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  };
  const [
    intentions,
    checkIns,
    memories,
    messages,
    entries,
    invitations,
    suggestions,
    events,
    feedback,
    entitlements,
  ] = await Promise.all([
    allRows("intentions"),
    allRows("check_ins", "intention_id"),
    allRows("memories"),
    allRows("messages"),
    allRows("journey_entries"),
    allRows("shared_invitations"),
    allRows("friend_suggestions"),
    allRows("product_events"),
    allRows("product_feedback"),
    allRows("entitlements", "user_id"),
  ]);
  return {
    exported_at: new Date().toISOString(),
    profile: local.profile,
    intentions,
    checkIns,
    memories,
    messages,
    entries: entries.map((r) => r.entry),
    invitations,
    suggestions,
    events,
    feedback,
    entitlements,
  };
}
