import type { Practice } from "./domain";
import { priorityName } from "./priorities";
import {
  missionFamilyId,
  missionUnavailableReason,
  type Round2Mission,
} from "./round2";

export type FocusMissionContext = {
  priority: string;
  interest: string;
  place: string;
};

/** A replacement must describe its own tags, never inherit an unrelated focus. */
export function contextForMission(
  mission: Round2Mission,
  preferred: FocusMissionContext,
): FocusMissionContext {
  const same = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();
  return {
    priority: mission.priorities.some(
      (name) => priorityName(name) === priorityName(preferred.priority),
    )
      ? preferred.priority
      : mission.priorities[0] || "",
    interest: mission.interests.some((name) => same(name, preferred.interest))
      ? preferred.interest
      : "",
    place: mission.places.some((name) => same(name, preferred.place))
      ? preferred.place
      : "",
  };
}

export function distinctEasyMission(
  candidates: readonly Round2Mission[],
  current: Round2Mission | undefined,
  currentId: string | null | undefined,
  practice: Practice,
  now = new Date(),
): Round2Mission | undefined {
  const family = current
    ? missionFamilyId(current)
    : currentId
      ? missionFamilyId(currentId)
      : undefined;
  return candidates.find(
    (mission) =>
      mission.active !== false &&
      mission.level === "easy" &&
      mission.id !== currentId &&
      (!family || missionFamilyId(mission) !== family) &&
      !missionUnavailableReason(mission, practice, now),
  );
}
