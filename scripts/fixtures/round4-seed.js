// Fictional local-only additions, called by the inherited offline QA transport.
window.__ROUND4_QA_SEED__ = ({ db, entry, now, uuid, owner, scenario }) => {
  const focus = (day) => ({
    id: uuid(),
    user_id: owner,
    revision: 1,
    day,
    action: "Call NASA about the API",
    value: "kind",
    interest: "",
    person: "",
    place: "",
    when_context: "after work",
    source: "typed",
    kind: "action",
    planet: "Be",
    mission_id: null,
    mission_step: null,
    level: null,
    type: "do",
    created_at: now(),
  });
  if (["evening", "offline-night", "previous-obstacle"].includes(scenario))
    db.intentions.push(focus("2026-11-26"));
  if (scenario === "previous-obstacle") {
    const previous = focus("2026-11-25");
    db.intentions.push(previous);
    db.check_ins.push({
      intention_id: previous.id,
      user_id: owner,
      revision: 1,
      outcome: "not_yet",
      energy: "neutral",
      reflection: "A fictional busy day.",
      created_at: now(),
    });
    db.journey_entries.push(
      entry("event", "Night obstacle", "active", "Ran out of time", {
        asked: true,
        focus_key: "typed:call nasa about the api",
        focus_day: "2026-11-25",
        intention_id: previous.id,
        obstacle_reason: "time",
      }),
    );
  }
  if (scenario === "next-day")
    db.journey_entries.push(
      entry(
        "preferences",
        "Action reminder",
        "active",
        "Open the NASA checklist",
        {
          reminder_day: "2026-11-27",
          status: "open",
          created_from: "night_obstacle",
          focus_day: "2026-11-26",
          priority: "kind",
          interest: "",
          place: "",
          level: "easy",
        },
      ),
    );
};
