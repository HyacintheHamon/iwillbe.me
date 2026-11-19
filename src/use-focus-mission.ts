import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { usePractice } from "./practice";
import {
  LEVELS,
  missionUnavailableReason,
  type Level,
  type Round2Mission,
} from "./round2";
import { missionLocalMoment, savedKidsAges } from "./mission-selection";
// The supplied catalogue always wins. AI is requested only for an uncovered choice.
export function useFocusMission(
  library: Round2Mission | undefined,
  tag: string,
  level: Level,
  enabled = true,
  context?: { priority?: string; where?: string; kind?: string },
) {
  const { session, data } = usePractice();
  const [generated, setGenerated] = useState<{
    key: string;
    rows: Round2Mission[];
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [passed, setPassed] = useState<{ key: string; ids: string[] } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, Round2Mission[]>());
  const owner = session?.user.id;
  const hasLibrary = !!library;
  const priority = context?.priority || "";
  const where = context?.where || "";
  const kind = context?.kind || "interest";
  const moment = missionLocalMoment(data);
  const contextKey = JSON.stringify([
    owner,
    tag,
    priority,
    where,
    kind,
    moment.day,
    moment.hour < 12 ? "morning" : moment.hour < 17 ? "afternoon" : "evening",
    savedKidsAges(data).join(","),
  ]);
  // Recorded passes survive reopening Today; the local list also takes effect
  // immediately after the feedback save while practice data is refreshing.
  const excludedMissionIds = [
    ...new Set([
      ...data.entries
        .filter(
          (entry) =>
            entry.kind === "event" &&
            entry.title === "Mission feedback" &&
            entry.meta.outcome === "passed" &&
            (!entry.meta.priority || entry.meta.priority === priority) &&
            Number.isFinite(Date.parse(entry.created_at)) &&
            missionLocalMoment(data, new Date(entry.created_at)).day ===
              moment.day,
        )
        .flatMap((entry) => [
          ...entry.source_ids,
          ...(entry.meta.mission_id ? [entry.meta.mission_id] : []),
        ]),
      ...(passed?.key === contextKey ? passed.ids : []),
    ]),
  ].sort();
  const exclusionKey = JSON.stringify(excludedMissionIds);
  const key = JSON.stringify([contextKey, exclusionKey]);
  useEffect(() => {
    let active = true;
    if (hasLibrary || !enabled || !tag.trim() || !owner) return;
    const saved = cache.current.get(key);
    if (saved) {
      setGenerated({ key, rows: saved });
      return;
    }
    setFailure(null);
    void supabase.functions
      .invoke("chloe", {
        body: {
          action: "missions",
          interest: tag,
          ladder_step: 1,
          priority,
          where,
          kind,
          excluded_mission_ids: JSON.parse(exclusionKey),
        },
      })
      .then((r) => {
        if (!active) return;
        if (r.error || r.data?.error || !r.data?.missions?.length) {
          setFailure({
            key,
            message:
              "Ideas could not load. You can retry or write your own focus.",
          });
          return;
        }
        const rows = r.data.missions as Round2Mission[];
        cache.current.set(key, rows);
        setGenerated({ key, rows });
      })
      .catch(() => {
        if (active)
          setFailure({
            key,
            message: "Ideas could not load. Please try again.",
          });
      });
    return () => {
      active = false;
    };
  }, [
    key,
    tag,
    hasLibrary,
    enabled,
    owner,
    retry,
    priority,
    where,
    kind,
    exclusionKey,
  ]);
  const rows = generated?.key === key ? generated.rows : [];
  const compatible = rows.filter(
    (item) => !missionUnavailableReason(item, data),
  );
  return {
    mission: library || compatible.find((m) => m.level === level),
    availableLevels: LEVELS.filter((candidate) =>
      compatible.some((m) => m.level === candidate),
    ),
    unavailableReasons: Object.fromEntries(
      rows
        .map((item) => [item.level, missionUnavailableReason(item, data)])
        .filter(([, reason]) => !!reason),
    ) as Partial<Record<Level, string>>,
    error:
      !hasLibrary && enabled && failure?.key === key ? failure.message : "",
    exclude: (missionId: string) =>
      setPassed((previous) => ({
        key: contextKey,
        ids: [
          ...new Set([
            ...(previous?.key === contextKey ? previous.ids : []),
            missionId,
          ]),
        ],
      })),
    retry: () => {
      cache.current.delete(key);
      setRetry((n) => n + 1);
    },
  };
}
