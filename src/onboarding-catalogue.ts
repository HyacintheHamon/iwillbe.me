import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { QUICK_PICKS, PRIORITY_WORDS } from "./priorities";
export function useOnboardingCatalogue() {
  const [cards, setCards] = useState(QUICK_PICKS),
    [priorities, setPriorities] = useState(PRIORITY_WORDS);
  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase
        .from("quick_pick_cards")
        .select("id,title,description,domain")
        .order("position"),
      supabase
        .from("priority_words")
        .select("name,priority_group")
        .order("position"),
    ]).then(([picks, words]) => {
      if (!alive) return;
      if (!picks.error && picks.data?.length) setCards(picks.data);
      if (!words.error && words.data?.length)
        setPriorities(
          words.data.map((p) => ({ name: p.name, group: p.priority_group })),
        );
    });
    return () => {
      alive = false;
    };
  }, []);
  return { cards, priorities };
}
export async function recordQuickPicks(
  choices: Record<string, string>,
  sessionId: string,
  cards: typeof QUICK_PICKS,
) {
  for (const card of cards) {
    const raw = choices[card.id];
    const choice = raw === "curious" ? "open" : raw;
    if (!["love", "like", "open", "pass"].includes(choice)) continue;
    const result = await supabase.rpc("record_quick_pick", {
      p_card: card.id,
      p_choice: choice,
      p_session: sessionId,
    });
    if (result.error)
      throw new Error(
        "Your quick picks couldn’t finish saving. Please try again; your choices are still here.",
      );
  }
}
export type PickResponse = {
  quick_pick_id: string;
  session_id: string;
  not_now_count: number;
  last_shown_at: string;
  choice: string;
};
export function eligibleQuickPick(
  response: PickResponse | undefined,
  sessionId: string,
  now = Date.now(),
) {
  if (!response || response.session_id === sessionId) return true;
  if (response.not_now_count >= 2) return false;
  return (
    response.choice !== "pass" ||
    now - Date.parse(response.last_shown_at) >= 90 * 86400000
  );
}
