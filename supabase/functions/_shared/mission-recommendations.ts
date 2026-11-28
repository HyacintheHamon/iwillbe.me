/** Private suggestion signals. These numbers are never shown to the person. */
export type MissionSignalAction =
  "shown" | "picked" | "passed" | "done" | "lit" | "neutral" | "drained";
export type MissionSignal = {
  missionId: string;
  action: MissionSignalAction;
  day: string;
};
export type RecommendationMission = {
  id: string;
  family_id?: string;
  ladder?: string;
  ladder_step: number;
  interests?: string[];
  places?: string[];
};

export const MISSION_REPEAT_DAYS = 28;
const norm = (text: string) => text.trim().toLowerCase();
export function recommendationFamily(mission: RecommendationMission | string) {
  const id = typeof mission === "string" ? mission : mission.id;
  if (typeof mission !== "string" && mission.family_id)
    return mission.family_id;
  if (id.startsWith("personal-"))
    return id.replace(/-(?:5-minute|Normal|Stretch)$/, "");
  const match = /^(.*?)[abc](\d*)$/.exec(id);
  return match ? match[1] + (match[2] ? `#${match[2]}` : "") : id;
}

export function signalAge(day: string, signalDay: string) {
  return (
    (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${signalDay}T12:00:00Z`)) /
    86400000
  );
}

/** A size change is the same idea. A saved reminder or explicit family lock can bypass this. */
export function recentMissionFamilies(
  signals: readonly MissionSignal[],
  day: string,
  pool: readonly RecommendationMission[] = [],
) {
  const byId = new Map(pool.map((mission) => [mission.id, mission]));
  return new Set(
    signals
      .filter((signal) => {
        const age = signalAge(day, signal.day);
        return Number.isFinite(age) && age >= 0 && age < MISSION_REPEAT_DAYS;
      })
      .map((signal) =>
        recommendationFamily(byId.get(signal.missionId) || signal.missionId),
      ),
  );
}

export type RecommendationProfile = {
  family: Map<string, number>;
  ladder: Map<string, number>;
  interest: Map<string, number>;
  recentLadders: Map<string, number>;
  recentPlaces: Map<string, number>;
  nextSteps: Map<string, number>;
  hasFeedback: boolean;
};
const add = (map: Map<string, number>, key: string, value: number) => {
  if (key) map.set(key, (map.get(key) || 0) + value);
};

/** Bounded, decaying preferences leave room for exploration and changing tastes. */
export function recommendationProfile(
  signals: readonly MissionSignal[],
  pool: readonly RecommendationMission[],
  day: string,
): RecommendationProfile {
  const result: RecommendationProfile = {
    family: new Map(),
    ladder: new Map(),
    interest: new Map(),
    recentLadders: new Map(),
    recentPlaces: new Map(),
    nextSteps: new Map(),
    hasFeedback: false,
  };
  const byId = new Map(pool.map((mission) => [mission.id, mission]));
  const seen = new Set<string>();
  const completed = new Set(
    signals
      .filter((s) => s.action === "done")
      .map((s) => `${s.missionId}:${s.day}`),
  );
  const values: Record<MissionSignalAction, number> = {
    shown: 0,
    picked: 0.5,
    passed: -2,
    done: 0.5,
    lit: 3,
    neutral: 0,
    drained: -4,
  };
  for (const signal of signals) {
    const key = `${signal.missionId}:${signal.day}:${signal.action}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const age = signalAge(day, signal.day);
    if (!Number.isFinite(age) || age < 0 || age >= 84) continue;
    const mission = byId.get(signal.missionId);
    if (!mission) continue;
    const decay = Math.pow(0.5, age / 28);
    const value = values[signal.action] * decay;
    if (value) result.hasFeedback = true;
    add(result.family, recommendationFamily(mission), value);
    if (mission.ladder) add(result.ladder, norm(mission.ladder), value * 0.6);
    for (const interest of mission.interests || [])
      add(result.interest, norm(interest), value * 0.35);
    if (
      signal.action === "lit" &&
      mission.ladder &&
      completed.has(`${signal.missionId}:${signal.day}`)
    ) {
      result.nextSteps.set(
        norm(mission.ladder),
        Math.min(
          5,
          Math.max(
            result.nextSteps.get(norm(mission.ladder)) || 1,
            mission.ladder_step + 1,
          ),
        ),
      );
    }
    // Recently shown ideas also rotate places and people, without treating a view as a dislike.
    if (signal.action === "shown" && age > 0 && age <= 3) {
      const rotation = (4 - age) / 3;
      if (mission.ladder)
        add(result.recentLadders, norm(mission.ladder), rotation);
      for (const place of mission.places || []) {
        if (!["anywhere", "for myself"].includes(norm(place)))
          add(result.recentPlaces, norm(place), rotation);
      }
    }
  }
  return result;
}

export function missionAffinity(
  mission: RecommendationMission,
  profile: RecommendationProfile,
) {
  const ladder = norm(mission.ladder || "");
  const interests = mission.interests || [];
  const interest = interests.length
    ? interests.reduce(
        (sum, name) => sum + (profile.interest.get(norm(name)) || 0),
        0,
      ) / interests.length
    : 0;
  const place = Math.max(
    0,
    ...(mission.places || []).map(
      (name) => profile.recentPlaces.get(norm(name)) || 0,
    ),
  );
  const next = profile.nextSteps.get(ladder) === mission.ladder_step ? 1.5 : 0;
  const score =
    (profile.family.get(recommendationFamily(mission)) || 0) +
    (profile.ladder.get(ladder) || 0) +
    interest +
    next -
    Math.min(1.5, (profile.recentLadders.get(ladder) || 0) * 0.4) -
    Math.min(0.75, place * 0.2);
  return Math.max(-6, Math.min(6, score));
}

export function suggestionHash(value: string) {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Weighted deterministic draw: positive feedback raises frequency, without always winning. */
export function recommendationRank(
  key: string,
  day: string,
  affinity: number,
  distance = 0,
) {
  const uniform = (suggestionHash(`${day}:${key}`) + 1) / 4294967297;
  const weight =
    Math.exp(Math.max(-6, Math.min(6, affinity)) / 3) / (1 + distance * 2);
  return -Math.log(uniform) / weight;
}
