// Fictional, local-only state. The transport never contacts a real account.
window.__ONBOARDING_QA_SEED__ = ({ db, entry, now, scenario }) => {
  const profile = db.profiles[0];
  profile.morning_time = "08:00";
  profile.evening_time = "21:00";
  if (scenario !== "new") return;
  Object.assign(profile, {
    display_name: "Taylor",
    joined_at: now(),
    baseline_answers: null,
    north_star: "",
    faith_tradition: null,
    values: [],
    interests: [],
    onboarded: false,
  });
  // Sign-up/privacy have already happened before the Welcome screen in this fixture.
  db.journey_entries.push(
    entry("preferences", "Privacy", "active", "", { analytics: true }),
  );
};
