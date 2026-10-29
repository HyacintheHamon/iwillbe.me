const serverFields = new Set([
  "id",
  "user_id",
  "revision",
  "created_at",
  "updated_at",
]);
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
};
const material = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => !serverFields.has(key) && item !== undefined)
      .map(([key, item]) => [
        key,
        key === "entry" && item && typeof item === "object"
          ? material(item as Record<string, unknown>)
          : canonical(item),
      ]),
  );
// A retry may follow a saved write whose response was lost. Adopt that saved
// version only when every field the request would change is already identical.
export function matchesDraft(
  draft: Record<string, unknown>,
  saved: Record<string, unknown> | null,
): boolean {
  if (!saved) return false;
  const expected = material(draft),
    actual = material(saved);
  return Object.keys(expected).every(
    (key) =>
      JSON.stringify(canonical(expected[key])) ===
      JSON.stringify(canonical(actual[key])),
  );
}
export function recordSummary(row: Record<string, unknown> | null): string {
  if (!row) return "This item was removed from your account.";
  const entry =
    row.entry && typeof row.entry === "object"
      ? (row.entry as Record<string, unknown>)
      : row;
  const named = (value: unknown, labels: Record<string, string>) =>
    typeof value === "string" ? labels[value] : null;
  const state =
    entry.kind === "interest"
      ? named(entry.state, {
          spark: "Maybe",
          maybe: "Maybe",
          unconfirmed: "Maybe",
          tried: "Tried it",
          love: "Into it",
          into_it: "Into it",
          ember: "On pause",
          paused: "On pause",
          on_pause: "On pause",
          craft: "All in",
          all_in: "All in",
        })
      : entry.kind === "value"
        ? named(entry.state, {
            trying: "Trying it on",
            mine: "Mine",
            let_go: "Let go",
          })
        : named(entry.state, {
            accepted: "Accepted",
            draft: "Draft",
            done: "Done",
            released: "Released",
            open: "Open question",
            answered: "Answered",
            paused: "On pause",
          });
  const lines = [
    entry.title,
    entry.body,
    entry.action,
    entry.reflection,
    entry.content,
    entry.when_context,
    entry.place,
    entry.with_person,
    entry.person,
    entry.value,
    named(entry.outcome, {
      yes: "I showed up",
      partly: "I showed up in part",
      not_yet: "Not this time",
    }),
    named(entry.energy, {
      lit: "It lit me up",
      neutral: "It felt neutral",
      drained: "It drained me",
    }),
    named(entry.value_choice, {
      yes: "Keep it",
      not_sure: "Still deciding",
      not_mine: "Let it go",
    }),
    state,
    entry.display_name,
    entry.north_star,
    entry.timezone ? `Timezone: ${entry.timezone}` : null,
    entry.morning_time ? `Morning: ${entry.morning_time}` : null,
    entry.evening_time ? `Night: ${entry.evening_time}` : null,
    Array.isArray(entry.values) ? entry.values.join(", ") : null,
    Array.isArray(entry.interests) ? entry.interests.join(", ") : null,
  ].filter(
    (value): value is string => typeof value === "string" && !!value.trim(),
  );
  if (entry.meta && typeof entry.meta === "object") {
    const meta = entry.meta as Record<string, unknown>;
    for (const [key, label] of Object.entries({
      pace: "Morning focus",
      orbit: "Area",
      morning_anchor: "Morning anchor",
      evening_anchor: "Night anchor",
      analytics: "Share usage measurements",
      stopped: "Paused",
      next_day: "Come back to this",
      focus_area: "This week's focus",
    })) {
      const value =
        key === "pace"
          ? named(meta[key], {
              stay: "Focus on one area",
              vary: "Rotate areas",
              guide: "Let Chloe choose",
            })
          : typeof meta[key] === "boolean"
            ? meta[key]
              ? "Yes"
              : "No"
            : meta[key];
      if (value !== undefined && value !== null)
        lines.push(`${label}: ${String(value)}`);
    }
  }
  return [...new Set(lines)].join("\n") || "Your saved settings.";
}
export function withoutRevision<T extends object>(value: T) {
  const rest = { ...value } as T & { revision?: number };
  delete rest.revision;
  return rest;
}
