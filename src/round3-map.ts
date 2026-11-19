import type { Practice } from "./domain";
import { interestState } from "./journey";
import { INTEREST_LINKS, norm, type Someday } from "./round2";

export type InterestLink = (typeof INTEREST_LINKS)[number];

function linkedInterests(interest: string): InterestLink[] {
  // Connections also work from the other end, so a newly discovered interest
  // can lead back into the map. Keep the library's reason without inventing one.
  return [
    ...INTEREST_LINKS.filter((link) => norm(link.interest) === norm(interest)),
    ...INTEREST_LINKS.filter(
      (link) => norm(link.similar_interest) === norm(interest),
    ).map((link) => ({
      interest,
      similar_interest: link.interest,
      reason: link.reason,
    })),
  ];
}

function newLinks(practice: Practice, links: InterestLink[]): InterestLink[] {
  const known = new Set(
    practice.entries
      .filter((entry) => entry.kind === "interest")
      .map((entry) => norm(entry.title)),
  );
  return links.filter((link) => {
    const key = norm(link.similar_interest);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
}

export function closeInterests(
  practice: Practice,
  interest: string,
  limit = 3,
) {
  return newLinks(practice, linkedInterests(interest)).slice(0, limit);
}

export function exploreInterests(practice: Practice, visit = 0, limit = 3) {
  const sources = practice.entries.filter(
    (entry) =>
      entry.kind === "interest" && interestState(practice, entry) === "Into it",
  );
  const links = newLinks(
    practice,
    sources.flatMap((entry) => linkedInterests(entry.title)),
  );
  if (!links.length) return [];
  // Advancing the window on every visit gives a fresh selection when there are
  // more than three eligible connections, without reshuffling on every render.
  const offset = Math.max(0, visit) % links.length;
  return [...links.slice(offset), ...links.slice(0, offset)].slice(0, limit);
}

export const HORIZON_QUESTIONS: Record<Someday["horizon"], string> = {
  this_year: "What would you like to make happen this year?",
  five_years: "What would you love to be doing five years from now?",
  ten_years: "What would you be glad you made room for in ten years?",
  later_in_life:
    "Looking back later in life, what would you love to have lived?",
};
