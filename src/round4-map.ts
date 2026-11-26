import type { Practice } from "./domain";
import { interestState, type Entry } from "./journey";
import { INTEREST_LINKS, MISSIONS, norm } from "./round2";

export type DiscoveryIdea = {
  title: string;
  reason: string;
  source: string;
};
export type DiscoveryGroups = {
  close: DiscoveryIdea[];
  different: DiscoveryIdea[];
};

/** The three everyday stages lead; deeper practice and paused interests remain reachable. */
export function growingInterests(practice: Practice): Entry[] {
  const order = [
    "Into it",
    "From time to time",
    "Want to try",
    "All in",
    "On pause",
  ];
  return practice.entries
    .filter((entry) => entry.kind === "interest")
    .slice()
    .sort(
      (a, b) =>
        order.indexOf(interestState(practice, a)) -
          order.indexOf(interestState(practice, b)) ||
        a.created_at.localeCompare(b.created_at),
    );
}

export function discoveryHistory(practice: Practice, today: string): string[] {
  const entry = practice.entries.find(
    (item) =>
      item.kind === "preferences" && item.title === "Interest discovery",
  );
  const previousDay = entry?.meta.last_shown_day;
  if (!previousDay) return [];
  const age =
    (Date.parse(`${today}T12:00:00Z`) -
      Date.parse(`${previousDay}T12:00:00Z`)) /
    86400000;
  return age >= 0 && age < 7 ? entry?.meta.blocks || [] : [];
}

function hash(text: string) {
  let result = 2166136261;
  for (const character of text)
    result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function neighbours(title: string): DiscoveryIdea[] {
  return INTEREST_LINKS.flatMap((link) => {
    if (norm(link.interest) === norm(title))
      return [
        { title: link.similar_interest, reason: link.reason, source: title },
      ];
    if (norm(link.similar_interest) === norm(title))
      return [{ title: link.interest, reason: link.reason, source: title }];
    return [];
  });
}

/** Library-backed discovery, with a shared exclusion set across both groups. */
export function discoverInterests(
  practice: Practice,
  excluded: readonly string[] = [],
  seed = "",
): DiscoveryGroups {
  const known = new Set(
    practice.entries
      .filter((entry) => entry.kind === "interest")
      .map((entry) => norm(entry.title)),
  );
  const blocked = new Set([...known, ...excluded.map(norm)]);
  const loved = growingInterests(practice).filter((entry) =>
    ["Into it", "All in"].includes(interestState(practice, entry)),
  );
  const sources = loved.length
    ? loved
    : growingInterests(practice).filter(
        (entry) => interestState(practice, entry) === "From time to time",
      );
  const direct = sources.flatMap((entry) => neighbours(entry.title));
  const farther = direct.flatMap((idea) =>
    neighbours(idea.title).map((next) => ({
      ...next,
      reason: `One step from ${idea.title}: ${next.reason}`,
    })),
  );
  const choose = (ideas: DiscoveryIdea[], limit: number): DiscoveryIdea[] => {
    const unique = new Map<string, DiscoveryIdea>();
    for (const idea of ideas) {
      const key = norm(idea.title);
      if (key && !blocked.has(key) && !unique.has(key)) unique.set(key, idea);
    }
    const ordered = [...unique.values()].sort(
      (a, b) => hash(`${seed}:${a.title}`) - hash(`${seed}:${b.title}`),
    );
    const result: DiscoveryIdea[] = [];
    for (const idea of ordered) {
      const key = norm(idea.title);
      if (!key || blocked.has(key)) continue;
      blocked.add(key);
      result.push(idea);
      if (result.length === limit) break;
    }
    return result;
  };
  let close = choose(direct, 3);
  if (close.length < 3)
    close = [...close, ...choose(farther, 3 - close.length)];

  // When there are no loved interests yet, priorities are a concrete starting point.
  if (!sources.length && close.length < 3) {
    const priorities = practice.entries.filter(
      (entry) =>
        entry.kind === "value" && !["let_go", "not_mine"].includes(entry.state),
    );
    const relevant = priorities.flatMap((priority) =>
      MISSIONS.filter((mission) =>
        mission.priorities.some((name) => norm(name) === norm(priority.title)),
      )
        .flatMap((mission) => mission.interests)
        .map((title) => ({
          title,
          source: priority.title,
          reason: `A way to explore being ${priority.title}.`,
        })),
    );
    close = [...close, ...choose(relevant, 3 - close.length)];
  }

  // Different ideas sit outside the immediate neighbourhood. A second-hop
  // interest can still be a change of direction when the library graph is small.
  const nearby = new Set(direct.map((idea) => norm(idea.title)));
  const all = [
    ...INTEREST_LINKS.flatMap((link) => [link.interest, link.similar_interest]),
    ...MISSIONS.flatMap((mission) => mission.interests),
  ];
  const different = choose(
    all
      .filter((title) => !nearby.has(norm(title)))
      .map((title) => ({
        title,
        source: "Something different",
        reason: "A different direction to explore with one small first step.",
      })),
    3,
  );
  return { close, different };
}

export function discoveryTitles(groups: DiscoveryGroups) {
  return [...groups.close, ...groups.different].map((idea) => idea.title);
}
