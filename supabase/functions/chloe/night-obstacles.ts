export const OBSTACLE_REASONS = [
  "time",
  "start",
  "big",
  "motivation",
  "unexpected",
  "unsure",
] as const;
export type ObstacleReason = (typeof OBSTACLE_REASONS)[number];
type Entry = {
  id: string;
  kind: string;
  title: string;
  updated_at?: string;
  created_at?: string;
  meta?: Record<string, unknown>;
};
export type NightObstacle = {
  id: string;
  focus_key: string;
  focus_day: string;
  intention_id: string | null;
  asked: true;
  obstacle_reason: ObstacleReason | null;
  obstacle_choice: "keep" | "release" | null;
  suggested_action: string | null;
  mission_id: string | null;
  updated_at: string;
};
type Focus = {
  id: string;
  day: string;
  outcome?: string | null;
  action?: string;
  mission_id?: string | null;
};
const short = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Only the private tap event supplies an obstacle; ordinary prose is not a label. */
export function savedNightObstacles(
  entries: Entry[],
  day: string,
): NightObstacle[] {
  const latest = new Map<string, NightObstacle>();
  for (const entry of [...entries].sort((a, b) =>
    (b.updated_at || b.created_at || "").localeCompare(
      a.updated_at || a.created_at || "",
    ),
  )) {
    const meta = entry.meta || {};
    const focusDay = short(meta.focus_day, 10);
    const focusKey = short(meta.focus_key, 500);
    if (
      entry.kind !== "event" ||
      entry.title !== "Night obstacle" ||
      meta.asked !== true ||
      !focusKey ||
      !/^\d{4}-\d{2}-\d{2}$/.test(focusDay) ||
      focusDay > day
    )
      continue;
    const key = `${focusDay}:${focusKey}`;
    if (latest.has(key)) continue;
    const reason = OBSTACLE_REASONS.includes(
      meta.obstacle_reason as ObstacleReason,
    )
      ? (meta.obstacle_reason as ObstacleReason)
      : null;
    const choice =
      meta.obstacle_choice === "keep" || meta.obstacle_choice === "release"
        ? meta.obstacle_choice
        : null;
    latest.set(key, {
      id: entry.id,
      focus_key: focusKey,
      focus_day: focusDay,
      intention_id: short(meta.intention_id, 100) || null,
      asked: true,
      obstacle_reason: reason,
      obstacle_choice: choice,
      // An unanswered question is not permission to manufacture a carry-forward.
      suggested_action:
        reason && choice !== "release"
          ? short(meta.suggested_action) || null
          : null,
      mission_id: reason ? short(meta.mission_id, 200) || null : null,
      updated_at: entry.updated_at || entry.created_at || "",
    });
  }
  return [...latest.values()].sort(
    (a, b) =>
      b.focus_day.localeCompare(a.focus_day) ||
      b.updated_at.localeCompare(a.updated_at),
  );
}

export function obstacleMatchesFocus(obstacle: NightObstacle, focus: Focus) {
  // A daily focus retains its database ID when replaced. Compare its action/family
  // too, so a previous question cannot follow a different focus with the same ID.
  let key: string | null = null;
  if (focus.mission_id) {
    const match = /^(.*?)[abc](\d*)$/.exec(focus.mission_id);
    const family = focus.mission_id.startsWith("personal-")
      ? focus.mission_id.replace(/-(?:5-minute|Normal|Stretch)$/, "")
      : match
        ? match[1] + (match[2] ? `#${match[2]}` : "")
        : focus.mission_id;
    key = `mission:${family}`;
  } else if (typeof focus.action === "string") {
    key = `typed:${focus.action
      .trim()
      .replace(/^I\s+will\s+/i, "")
      .replace(/\s+/g, " ")
      .replace(/[.!?]+$/, "")
      .toLowerCase()}`;
  }
  return (
    obstacle.focus_day === focus.day &&
    (!obstacle.intention_id || obstacle.intention_id === focus.id) &&
    (!key || obstacle.focus_key === key)
  );
}

/** Worst-case is an occasional follow-up to reported hesitation, never a guess. */
export function hesitationObstacle(
  obstacles: NightObstacle[],
  focuses: Focus[],
  day: string,
  hardDay = false,
) {
  if (hardDay) return null;
  const cutoff = new Date(Date.parse(`${day}T12:00:00Z`) - 6 * 86400000)
    .toISOString()
    .slice(0, 10);
  const seen = new Set<string>();
  for (const obstacle of obstacles) {
    if (seen.has(obstacle.focus_key)) continue;
    seen.add(obstacle.focus_key);
    if (
      obstacle.focus_day < cutoff ||
      obstacle.focus_day > day ||
      obstacle.obstacle_choice === "release" ||
      !["big", "motivation"].includes(obstacle.obstacle_reason || "")
    )
      continue;
    const focus = focuses.find((item) => obstacleMatchesFocus(obstacle, item));
    if (focus && ["partly", "not_yet"].includes(focus.outcome || ""))
      return obstacle;
  }
  return null;
}

export function obstacleCarryForward(
  obstacle: NightObstacle | null | undefined,
) {
  if (
    !obstacle?.obstacle_reason ||
    obstacle.obstacle_choice === "release" ||
    !obstacle.suggested_action
  )
    return null;
  return {
    kind: "carry_forward" as const,
    text: obstacle.suggested_action,
    focus_text: obstacle.suggested_action,
    item_id: null,
    mission_id: obstacle.mission_id,
  };
}
