export type Mission = {
  id: string;
  mission_text: string;
  first_step: string;
  area: "Be" | "People" | "Causes" | "Passions" | "Grow";
  tags: string[];
  quick_picks: string[];
  priorities: string[];
  who_for: string[];
  ladder_step: number;
  stage: string;
  size: "5-minute" | "Normal" | "Stretch";
  minutes: number;
  cost: string;
  setting: string;
  safety_note: string;
  user_id?: string | null;
  provenance?: string;
};
export const normalizeTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^iwillbe\./, "")
    .replace(/[.!]$/, "");
const aliases: Record<string, string> = {
  cooking: "cooking for friends",
  reading: "reading",
  gardening: "gardening",
  fitness: "working out",
  exercise: "working out",
  photography: "taking photos",
  music: "making music",
  hiking: "hiking",
  volunteering: "volunteering",
  mentoring: "mentoring someone",
  languages: "learning a language",
  meditation: "meditating",
  patience: "patient",
  kindness: "kind",
  curiosity: "curious",
  courage: "brave",
  creativity: "creative",
  gratitude: "grateful",
  honesty: "honest",
  wisdom: "wise",
};
export const missionTag = (value: string) =>
  aliases[normalizeTag(value)] || normalizeTag(value);
export function matchingMissions(missions: Mission[], tag: string, step = 1) {
  const key = missionTag(tag);
  return missions.filter(
    (m) =>
      m.ladder_step === step &&
      [...m.tags, ...m.quick_picks, ...m.priorities].some(
        (t) => missionTag(t) === key,
      ),
  );
}
export function missionTrio(missions: Mission[], offset = 0) {
  return (["5-minute", "Normal", "Stretch"] as const).flatMap((size) => {
    const choices = missions.filter((m) => m.size === size);
    return choices.length ? [choices[offset % choices.length]] : [];
  });
}
// Original starter content, not Kelly's 692-row library. Importing that library
// replaces/extends the database catalogue without a client release.
const starters: [string, Mission["area"], string, string, string][] = [
  [
    "cooking for friends",
    "People",
    "Ask a friend what simple dish they would enjoy sharing.",
    "Cook a simple meal and invite a friend to share it.",
    "Plan and cook a two-course meal with a friend.",
  ],
  [
    "reading",
    "Passions",
    "Read two pages of a book you already have.",
    "Read one chapter without your phone nearby.",
    "Read a short story and talk about it with someone.",
  ],
  [
    "exploring new places",
    "Passions",
    "Choose one nearby street you have never walked down.",
    "Take a walk along a new route near home.",
    "Visit a neighbourhood you have never explored and sketch what you notice.",
  ],
  [
    "gardening",
    "Passions",
    "Check the soil and remove dead leaves from one plant.",
    "Plant a seed or repot a plant using supplies you have.",
    "Plan and plant a small container garden suited to your space.",
  ],
  [
    "working out",
    "Passions",
    "Try five minutes of comfortable movement at your own pace.",
    "Do a familiar workout at a comfortable intensity.",
    "Try a beginner class suited to your experience and access needs.",
  ],
  [
    "hiking",
    "Passions",
    "Find a short marked trail and check its access and weather.",
    "Walk an easy familiar trail in daylight, with water.",
    "Plan a longer marked walk with a friend, checking conditions first.",
  ],
  [
    "playing sports",
    "Passions",
    "Practise one familiar skill with equipment you have.",
    "Invite someone to play a casual game.",
    "Join a beginner-friendly game after checking its level and access.",
  ],
  [
    "making music",
    "Passions",
    "Tap out a rhythm or hum a short melody.",
    "Practise a short piece or make a simple recording.",
    "Learn a song and play or sing it with someone.",
  ],
  [
    "taking photos",
    "Passions",
    "Photograph one detail in the light around you.",
    "Take five photos on a walk and choose your favourite.",
    "Make a small photo series around one theme and share it with a friend.",
  ],
  [
    "building things",
    "Passions",
    "Sketch a small object you would like to build.",
    "Make a paper or cardboard prototype with supplies you have.",
    "Build a simple useful object using tools you know how to use safely.",
  ],
  [
    "hosting game night",
    "People",
    "Ask two friends which game they would like to play.",
    "Invite a friend to play a game you already own.",
    "Host a small game night and teach everyone one game.",
  ],
  [
    "volunteering",
    "Causes",
    "Read one local organisation’s volunteer information.",
    "Contact an organisation and ask about a suitable first volunteer task.",
    "Arrange an introductory volunteer session after checking its requirements.",
  ],
  [
    "mentoring someone",
    "People",
    "Ask someone learning your skill what they are stuck on.",
    "Offer to walk someone through one thing you know how to do.",
    "Arrange a mentoring conversation and prepare one exercise together.",
  ],
  [
    "learning a language",
    "Grow",
    "Say three useful phrases aloud in a language you want to learn.",
    "Practise a short everyday conversation in your chosen language.",
    "Arrange a short language exchange with a willing partner.",
  ],
  [
    "meditating",
    "Grow",
    "Sit comfortably and notice your surroundings for a few minutes.",
    "Try a short guided meditation, stopping if it feels uncomfortable.",
    "Set aside a quiet session to explore a meditation practice that suits you.",
  ],
];
const priorityActions: Record<string, string> = {
  kind: "do one small helpful thing for someone",
  loving: "tell someone you love one specific thing you appreciate about them",
  "a good friend": "reach out to a friend and listen to how they are doing",
  "there for family": "ask a family member how you can help today",
  loyal: "follow through on a promise you have made",
  respectful: "listen to someone’s view without interrupting",
  fair: "invite an overlooked person to give their view",
  "good with people":
    "start a conversation with someone and ask a thoughtful question",
  "a team player": "offer a teammate help with one concrete task",
  "a leader": "clarify the next step for a shared task and invite input",
  forgiving:
    "write privately about a small resentment you would like to loosen, without contacting anyone",
  "of service": "offer practical help with something someone has asked for",
  "part of a community":
    "join a conversation or activity in a community you belong to",
  patient: "leave a pause before replying in a conversation",
  honest: "say one true thing kindly that you have been avoiding",
  brave: "take one safe first step on a task you have put off",
  persistent: "return to one unfinished task and take the next small step",
  disciplined: "put your phone aside and begin a task you chose",
  humble: "ask someone to teach you something they know",
  grateful: "thank someone for a specific thing they did",
  hopeful: "write down one possibility you can take a small step toward",
  calm: "take a quiet pause before moving to your next task",
  curious: "ask a question about something you do not understand",
  creative: "make a small sketch or write a few lines without judging them",
  "a clear thinker":
    "write the facts and assumptions behind one decision separately",
  wise: "ask an experienced person what they learned from a similar choice",
  "always learning": "learn one small thing and try using it",
  ambitious: "choose the next concrete step toward a goal you care about",
  independent: "make one small everyday choice using your own judgment",
  healthy: "prepare something nourishing that fits your needs",
  energetic: "take a comfortable movement break",
  adventurous: "try a safe activity or route that is new to you",
  funny: "share something lighthearted with someone who would enjoy it",
  free: "make space for an activity you choose for yourself",
  secure: "organise one small part of your space so it works better for you",
  "close to nature": "spend time outside noticing what is growing nearby",
  "guided by faith": "make room for a practice from your own tradition",
  "seeing beauty": "notice and describe one beautiful detail around you",
};
export const STARTER_MISSIONS: Mission[] = [
  ...starters.flatMap(([tag, area, ...actions]) =>
    actions.map((action, i) => ({ tag, area, action, i, priority: false })),
  ),
  ...Object.entries(priorityActions).flatMap(([tag, action]) =>
    [0, 1, 2].map((i) => ({
      tag,
      area: "Be" as const,
      action:
        i === 0
          ? `Take five minutes to ${action}.`
          : i === 1
            ? `${action[0].toUpperCase()}${action.slice(1)}. read`.replace(
                ". read",
                ".",
              )
            : `Make space today to ${action}, then note what you learned.`,
      i,
      priority: true,
    })),
  ),
].map(({ tag, area, action, i, priority }) => ({
  id: `starter-${tag.replaceAll(" ", "-")}-${i + 1}`,
  mission_text: action,
  first_step: priority ? "Choose a specific moment today to begin." : action,
  area,
  tags: [tag],
  quick_picks: priority ? [] : [tag],
  priorities: priority ? [tag] : [],
  who_for: ["self"],
  ladder_step: 1,
  stage: "Maybe",
  size: (["5-minute", "Normal", "Stretch"] as const)[i],
  minutes: [5, 20, 45][i],
  cost: "Free",
  setting: "Choose what is accessible to you",
  safety_note: [
    "hiking",
    "working out",
    "playing sports",
    "building things",
  ].includes(tag)
    ? "Choose a safe setting and familiar equipment. Adapt to your abilities and stop if uncomfortable."
    : "",
  provenance: "Original beta starter content, November 2026",
}));
