export const PRIORITY_GROUPS = {
  "With people": [
    "kind",
    "loving",
    "a good friend",
    "there for family",
    "loyal",
    "respectful",
    "fair",
    "good with people",
    "a team player",
    "a leader",
    "forgiving",
    "of service",
    "part of a community",
  ],
  Character: [
    "patient",
    "honest",
    "brave",
    "persistent",
    "disciplined",
    "humble",
    "grateful",
    "hopeful",
    "calm",
  ],
  Mind: [
    "curious",
    "creative",
    "a clear thinker",
    "wise",
    "always learning",
    "ambitious",
    "independent",
  ],
  "Living fully": [
    "healthy",
    "energetic",
    "adventurous",
    "funny",
    "free",
    "secure",
    "close to nature",
    "guided by faith",
    "seeing beauty",
  ],
} as const;
export const PRIORITY_WORDS = Object.entries(PRIORITY_GROUPS).flatMap(
  ([group, names]) => names.map((name) => ({ name, group })),
);
export const FAITH_TRADITIONS = [
  "Christian",
  "Jewish",
  "Muslim",
  "Hindu",
  "Buddhist",
  "Sikh",
  "Spiritual, from many traditions",
  "Prefer not to say",
] as const;
const aliases: Record<string, string> = {
  patience: "patient",
  kindness: "kind",
  curiosity: "curious",
  courage: "brave",
  creativity: "creative",
  gratitude: "grateful",
  honesty: "honest",
  wisdom: "wise",
  perseverance: "persistent",
  fairness: "fair",
  humility: "humble",
};
export function priorityName(name: string) {
  const key = name.trim().toLowerCase();
  return aliases[key] || key;
}
export const QUICK_PICKS = [
  ["cooking for friends", "Make something good and share it.", "People"],
  ["reading", "Get lost in a story or a new idea.", "Passions"],
  [
    "exploring new places",
    "Find something unfamiliar close to home.",
    "Passions",
  ],
  ["gardening", "Grow something and watch it change.", "Passions"],
  ["working out", "Move in a way that feels good to you.", "Passions"],
  ["hiking", "Spend time outside, one path at a time.", "Passions"],
  ["playing sports", "Play, practise, or join a game.", "Passions"],
  ["making music", "Make room for a sound of your own.", "Passions"],
  ["taking photos", "Notice something worth looking at again.", "Passions"],
  ["building things", "Turn an idea into something you can use.", "Passions"],
  ["hosting game night", "Bring people together around a game.", "People"],
  ["volunteering", "Give a little time to something you care about.", "Causes"],
  ["mentoring someone", "Share something you have learned.", "People"],
  ["learning a language", "Find another way to connect.", "Grow"],
  ["meditating", "Sit, notice, and make a little space.", "Grow"],
].map(([title, description, domain]) => ({
  id: title.replaceAll(" ", "-"),
  title,
  description,
  domain,
}));
