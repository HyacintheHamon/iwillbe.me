import { useEffect, useState } from "react";
import { usePractice } from "./practice";
import { supabase } from "./supabase";
import { MISSIONS, missionFamilyId, type Round2Mission } from "./round2";

type StoredMission = Round2Mission & { user_id?: string | null };

/** Explicit ownership filters supplement RLS; an ID alone never selects another account's data. */
export async function loadOwnedMissionFamily(
  ownerId: string,
  missionId: string,
): Promise<Round2Mission[]> {
  const library = MISSIONS.find((mission) => mission.id === missionId);
  if (library)
    return MISSIONS.filter(
      (mission) => missionFamilyId(mission) === missionFamilyId(library),
    );
  const current = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (current.error || !current.data || current.data.user_id !== ownerId)
    throw new Error("Your saved idea could not load. Please try again.");
  const mission = current.data as StoredMission;
  const familyId = missionFamilyId(mission);
  if (!mission.family_id) return [mission];
  const response = await supabase
    .from("missions")
    .select("*")
    .eq("family_id", familyId)
    .eq("user_id", ownerId);
  if (response.error)
    throw new Error(
      "The other sizes of this idea could not load. Please try again.",
    );
  const rows = (response.data || []).filter(
    (row: StoredMission) =>
      row.user_id === ownerId && missionFamilyId(row) === familyId,
  );
  if (!rows.some((row: StoredMission) => row.id === missionId))
    rows.push(mission);
  return rows;
}

export function useSavedMissionFamily(missionId: string | null | undefined) {
  const { session } = usePractice();
  const ownerId = session?.user.id;
  const [loaded, setLoaded] = useState<{
    owner: string;
    rows: Round2Mission[];
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const library = MISSIONS.find((mission) => mission.id === missionId);
  const saved =
    loaded && loaded.owner === ownerId
      ? loaded.rows.find((mission) => mission.id === missionId)
      : undefined;
  const key = `${ownerId || ""}:${missionId || ""}`;
  const available = !!library || !!saved;
  useEffect(() => {
    let active = true;
    if (!ownerId || !missionId || available) return;
    void loadOwnedMissionFamily(ownerId, missionId)
      .then((rows) => {
        if (active) {
          setLoaded({ owner: ownerId, rows });
          setFailure(null);
        }
      })
      .catch((error) => {
        if (active)
          setFailure({
            key,
            message:
              error instanceof Error
                ? error.message
                : "Your saved idea could not load.",
          });
      });
    return () => {
      active = false;
    };
  }, [ownerId, missionId, available, attempt, key]);
  const rows = library
    ? MISSIONS.filter(
        (mission) => missionFamilyId(mission) === missionFamilyId(library),
      )
    : saved
      ? loaded!.rows
      : [];
  return {
    mission: library || saved,
    rows,
    error: failure?.key === key ? failure.message : "",
    loading: !!ownerId && !!missionId && !available && failure?.key !== key,
    retry: () => {
      setFailure(null);
      setAttempt((value) => value + 1);
    },
  };
}

/** Uses the same authenticated Chloe endpoint as useFocusMission, with family-wide passes. */
export async function requestAlternativeMissionFamily(input: {
  ownerId: string;
  tag: string;
  priority: string;
  where: string;
  kind: "interest" | "place" | "anywhere";
  step: number;
  excludedMissionIds: string[];
}): Promise<Round2Mission[]> {
  const authentication = await supabase.auth.getSession();
  const session = authentication.data.session;
  if (authentication.error || session?.user.id !== input.ownerId)
    throw new Error("Your account changed. Please choose an idea again.");
  const reply = await supabase.functions.invoke("chloe", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      action: "missions",
      interest: input.tag,
      ladder_step: input.step,
      priority: input.priority,
      where: input.where,
      kind: input.kind,
      excluded_mission_ids: [...new Set(input.excludedMissionIds)],
    },
  });
  if (reply.error || reply.data?.error || !Array.isArray(reply.data?.missions))
    throw new Error(
      "Another idea could not load. Please try again, or write your own focus.",
    );
  const currentAuthentication = await supabase.auth.getSession();
  if (currentAuthentication.data.session?.user.id !== input.ownerId)
    throw new Error("Your account changed. Please choose an idea again.");
  const rows = (reply.data.missions as StoredMission[]).filter(
    (mission) => !mission.user_id || mission.user_id === input.ownerId,
  );
  if (!rows.length)
    throw new Error("Another idea could not load. Please try again.");
  return rows;
}
