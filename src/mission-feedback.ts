import type { Practice } from "./domain";
import { dayInZone, entryInput, type EntryInput } from "./journey";
import type { Round2Mission } from "./round2";
import {
  suggestionHash,
  type MissionSignal,
  type RecommendationMission,
} from "../supabase/functions/_shared/mission-recommendations";

export type MissionFeedbackAction = "shown" | "picked" | "passed";
export type MissionFeedbackSource = "today" | "build_action";

/** Stable per owner and local day, so re-renders and retries do not inflate observations. */
export function missionFeedbackEntry(
  mission: Round2Mission,
  action: MissionFeedbackAction,
  day: string,
  source: MissionFeedbackSource,
  ownerId: string,
): EntryInput {
  if (!ownerId || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error(
      "A suggestion observation needs its account and local day.",
    );
  const key = JSON.stringify([
    "mission-feedback-v1",
    ownerId,
    mission.id,
    day,
    source,
    action,
  ]);
  const bytes = [0, 1, 2, 3]
    .map((salt) =>
      suggestionHash(`${salt}:${key}`).toString(16).padStart(8, "0"),
    )
    .join("");
  const id = `${bytes.slice(0, 8)}-${bytes.slice(8, 12)}-5${bytes.slice(13, 16)}-a${bytes.slice(17, 20)}-${bytes.slice(20, 32)}`;
  return entryInput("event", "Mission feedback", {
    id,
    state: action,
    source,
    source_ids: [mission.id],
    meta: {
      mission_id: mission.id,
      outcome: action,
      feedback_day: day,
      priority: mission.priorities[0],
      theme: mission.theme || undefined,
      interest: mission.interests[0],
      place: mission.places[0],
    },
  });
}

/** Include the person's private ideas when learning preferences for custom interests. */
export function missionRecommendationPool(
  practice: Practice,
  pool: readonly RecommendationMission[],
): RecommendationMission[] {
  const result = new Map(pool.map((mission) => [mission.id, mission]));
  for (const entry of practice.entries) {
    const snapshot = entry.meta.mission_snapshot;
    if (snapshot && !result.has(snapshot.id)) result.set(snapshot.id, snapshot);
  }
  for (const intention of practice.intentions) {
    if (!intention.mission_id || result.has(intention.mission_id)) continue;
    const interest =
      intention.interest ||
      practice.entries.find((entry) => entry.id === intention.interest_id)
        ?.title ||
      "";
    result.set(intention.mission_id, {
      id: intention.mission_id,
      ladder: interest,
      ladder_step: intention.mission_step || 1,
      interests: interest ? [interest] : [],
      places: intention.place ? [intention.place] : [],
    });
  }
  for (const entry of practice.entries) {
    if (
      entry.kind !== "event" ||
      entry.title !== "Mission feedback" ||
      !entry.meta.mission_id ||
      result.has(entry.meta.mission_id)
    )
      continue;
    result.set(entry.meta.mission_id, {
      id: entry.meta.mission_id,
      ladder: entry.meta.interest,
      ladder_step: 1,
      interests: entry.meta.interest ? [entry.meta.interest] : [],
      places: entry.meta.place ? [entry.meta.place] : [],
    });
  }
  return [...result.values()];
}

/** Personalization is private app state, separate from optional cross-user analytics. */
export function missionSignals(practice: Practice): MissionSignal[] {
  const signals: MissionSignal[] = [];
  const seen = new Set<string>();
  const push = (signal: MissionSignal) => {
    if (!signal.missionId || !/^\d{4}-\d{2}-\d{2}$/.test(signal.day)) return;
    const key = `${signal.missionId}:${signal.day}:${signal.action}`;
    if (!seen.has(key)) {
      seen.add(key);
      signals.push(signal);
    }
  };
  for (const entry of practice.entries) {
    if (entry.kind !== "event" || entry.title !== "Mission feedback") continue;
    const action =
      entry.meta.outcome || (entry.state === "let_go" ? "passed" : undefined);
    if (!action || !["shown", "picked", "passed"].includes(action)) continue;
    const timestamp = new Date(entry.created_at);
    const day =
      entry.meta.feedback_day ||
      (Number.isFinite(timestamp.getTime())
        ? dayInZone(practice.profile.timezone, timestamp)
        : "");
    for (const missionId of new Set(
      [entry.meta.mission_id, ...entry.source_ids].filter(
        (id): id is string => !!id,
      ),
    ))
      push({ missionId, action, day });
  }
  for (const intention of practice.intentions) {
    if (!intention.mission_id) continue;
    const base = { missionId: intention.mission_id, day: intention.day };
    push({ ...base, action: "picked" });
    const check = practice.checkIns.find(
      (item) => item.intention_id === intention.id,
    );
    if (check?.outcome === "yes") push({ ...base, action: "done" });
    // Feeling is independent of completion, and an unanswered feeling stays unknown.
    if (check?.energy) push({ ...base, action: check.energy });
  }
  return signals;
}
