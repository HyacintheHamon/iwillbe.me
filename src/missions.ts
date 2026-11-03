import { supabase } from "./supabase";
import {
  STARTER_MISSIONS,
  matchingMissions,
  missionTrio,
  missionTag,
  type Mission,
} from "../supabase/functions/_shared/missions";
export {
  STARTER_MISSIONS,
  matchingMissions,
  missionTrio,
  missionTag,
} from "../supabase/functions/_shared/missions";
export type { Mission } from "../supabase/functions/_shared/missions";
export { ladderStep } from "./mission-progress";
export async function loadMissions(
  tag: string,
  step = 1,
): Promise<{ missions: Mission[]; source: string }> {
  const safety = await supabase
    .from("support_state")
    .select("level")
    .maybeSingle();
  if (safety.error)
    throw new Error("Ideas couldn’t load. Try again in a moment.");
  if ((safety.data?.level || 0) >= 2)
    throw new Error(
      "Take some space for support. You can return to actions at your next check-in.",
    );
  const { data, error } = await supabase.rpc("mission_options", {
    p_tag: missionTag(tag),
    p_step: step,
  });
  if (
    !error &&
    data &&
    missionTrio(matchingMissions(data, tag, step)).length === 3
  )
    return { missions: matchingMissions(data, tag, step), source: "library" };
  const starter = matchingMissions(STARTER_MISSIONS, tag, step);
  if (starter.length === 3) return { missions: starter, source: "starter" };
  const response = await supabase.functions.invoke("chloe", {
    body: { action: "missions", interest: tag, ladder_step: step },
  });
  if (response.error || response.data?.error)
    throw new Error(
      "Ideas couldn’t load. Try again, or write your own action.",
    );
  if (
    !Array.isArray(response.data?.missions) ||
    missionTrio(response.data.missions).length !== 3
  )
    throw new Error(
      "Ideas couldn’t load. You can still write your own action.",
    );
  return { missions: response.data.missions, source: "personal" };
}
