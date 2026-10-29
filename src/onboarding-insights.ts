export type OnboardingStory = {
  question: string;
  answer: string;
  follow_up?: string;
};
export type OnboardingProposal = {
  kind: "interest" | "strength" | "person" | "value";
  title: string;
  body: string;
  evidence: { story_index: number; quote: string }[];
};
export type OnboardingInsights = {
  proposals: OnboardingProposal[];
  follow_up?: { story_index: number; question: string } | null;
};

const VALUE_WORDS = [
  ["Patience", /\b(?:patience|patient)\b/gi],
  ["Kindness", /\b(?:kindness|kind)\b/gi],
  ["Courage", /\b(?:courage|courageous|bravery|brave)\b/gi],
  ["Fairness", /\b(?:fairness|fair)\b/gi],
  ["Honesty", /\b(?:honesty|honest)\b/gi],
  ["Creativity", /\b(?:creativity|creative)\b/gi],
  ["Curiosity", /\b(?:curiosity|curious)\b/gi],
  ["Reliability", /\b(?:reliability|reliable|dependable)\b/gi],
  ["Generosity", /\b(?:generosity|generous)\b/gi],
] as const;

// Keep quotes as literal substrings. A contrast starts a new thought, so
// "never patient, but brave" cannot turn the negative clause into a value.
function clauses(text: string) {
  return text
    .split(/[.!?;\n]+|\b(?:but|however|whereas|instead)\b/i)
    .map((part) => part.replace(/^[,\s]+|[,\s]+$/g, ""))
    .filter(Boolean);
}
function evidenceContexts(story: OnboardingStory, quote: string) {
  return [story.answer, story.follow_up || ""]
    .filter((text) => text.includes(quote))
    .flatMap((text) => {
      const containing = clauses(text).filter((clause) =>
        clause.includes(quote),
      );
      return containing.length
        ? containing.map((clause) => {
            const afterward = text
              .slice(text.indexOf(clause) + clause.length)
              .split(/[.!?;\n]/)[0];
            return /^,?\s*(?:but|however)\b.*\b(?:don't|do not|never|can't)\s+(?:admire|value|want|like|respect)\b/i.test(
              afterward,
            )
              ? clause + afterward
              : clause;
          })
        : [text];
    });
}
function negativeClaim(text: string) {
  const literal = text
    .replace(/[’]/g, "'")
    .replace(/\bnot only\b/gi, "")
    .replace(/\b(?:couldn't|can't|cannot) stop\b/gi, "");
  return /\b(?:not|never|no|nobody|nothing|none|neither|hardly|rarely|without|lack|lacking|lacks|hate|hated|dislike|disliked|resent|resented|forced|should|supposed to|isn't|wasn't|weren't|aren't|don't|didn't|doesn't|can't|couldn't|cannot|unable)\b/i.test(
    literal,
  );
}
function valueUseIsLiteral(
  title: string,
  clause: string,
  match: RegExpMatchArray,
) {
  const before = clause.slice(0, match.index).toLowerCase();
  const after = clause
    .slice((match.index || 0) + match[0].length)
    .toLowerCase();
  const word = match[0].toLowerCase();
  if (title === "Kindness" && word === "kind" && /^\s+of\b/.test(after))
    return false;
  if (title === "Honesty" && /\bto be\s*$/.test(before)) return false;
  if (title === "Fairness" && word === "just") return false;
  if (
    title === "Fairness" &&
    word === "fair" &&
    (/\b(?:a|the|at|county|summer)\s*$/.test(before) ||
      /^\s+(?:amount|bit|share|weather|skin|hair)\b/.test(after))
  )
    return false;
  if (
    title === "Patience" &&
    word === "patient" &&
    /\b(?:a|the|another|each|every|hospital|my)\s*$/.test(before) &&
    !/^\s+(?:person|parent|father|mother|teacher|friend|listener|partner)\b/.test(
      after,
    )
  )
    return false;
  return !negativeClaim(clause);
}
export function affirmativeValues(text: string) {
  const found: { title: string; quote: string; position: number }[] = [];
  for (const clause of clauses(text)) {
    const afterward = text
      .slice(text.indexOf(clause) + clause.length)
      .split(/[.!?;\n]/)[0];
    if (
      /^,?\s*(?:but|however)\b.*\b(?:don't|do not|never|can't)\s+(?:admire|value|want|like|respect)\b/i.test(
        afterward,
      )
    )
      continue;
    for (const [title, pattern] of VALUE_WORDS) {
      for (const match of clause.matchAll(new RegExp(pattern))) {
        if (valueUseIsLiteral(title, clause, match))
          found.push({
            title,
            quote: clause,
            position: text.indexOf(clause) + (match.index || 0),
          });
      }
    }
  }
  return found
    .sort((a, b) => a.position - b.position)
    .filter(
      (item, index, all) =>
        all.findIndex((other) => other.title === item.title) === index,
    );
}
export function firstAffirmativeValue(stories: string[]) {
  for (const story of stories) {
    const first = affirmativeValues(story)[0];
    if (first) return first;
  }
  return null;
}

const ACTIVITIES = [
  [
    "Ceramics",
    /\b(?:pottery|ceramics|throwing (?:a |the )?pot|making (?:a |the )?bowl|shaping (?:a |the )?clay)\b/i,
  ],
  [
    "Repairing things",
    /\b(?:repairing|repaired|fixing|fixed|mending|mended)\b/i,
  ],
  ["Teaching", /\b(?:teaching|taught|tutoring|tutored)\b/i],
  ["Drawing", /\b(?:drawing|drew|sketching|sketched)\b/i],
  ["Painting", /\b(?:painting|painted)\b/i],
  ["Reading", /\b(?:reading|read books|read novels)\b/i],
  ["Cooking", /\b(?:cooking|cooked|baking|baked)\b/i],
  [
    "Gardening",
    /\b(?:gardening|gardened|growing vegetables|tending plants)\b/i,
  ],
  ["Dancing", /\b(?:dancing|danced)\b/i],
  [
    "Creative writing",
    /\b(?:writing|wrote) (?:stories|poems|poetry|a story|a poem|fiction)\b/i,
  ],
  [
    "Making music",
    /\b(?:playing|played) (?:the )?(?:piano|guitar|violin|drums|music)\b|\b(?:singing|sang|composing music)\b/i,
  ],
  ["Photography", /\b(?:photography|taking photos|taking photographs)\b/i],
  ["Hiking", /\b(?:hiking|hiked)\b/i],
  ["Cycling", /\b(?:cycling|cycled|riding (?:my |a )?bike)\b/i],
  ["Volunteering", /\b(?:volunteering|volunteered)\b/i],
  ["Creative coding", /\b(?:coding|programming|coded|programmed)\b/i],
  [
    "Learning a language",
    /\b(?:learning|learned|studying|studied) (?:a language|French|Spanish|Italian|Japanese|Arabic|German|Chinese)\b/i,
  ],
  [
    "Textile crafts",
    /\b(?:knitting|knitted|sewing|sewed|crocheting|crocheted)\b/i,
  ],
] as const;

function selfDescribedActivity(clause: string, index: number) {
  const before = clause.slice(0, index).trim();
  if (negativeClaim(clause)) return false;
  if (
    /\b(?:watch|watching|watched|see|seeing|saw|hear|heard|admire|admired|wished|wish|want|wanted|hoping|hope)\b/i.test(
      before,
    )
  )
    return false;
  // A short direct answer such as "Making a bowl with a friend" has an
  // implicit first-person subject. Explicitly other people's actions do not.
  if (
    !before ||
    /^(?:when |while |recently |last weekend[:,]?\s*)$/i.test(before)
  )
    return true;
  const subjects = [
    ...before.matchAll(
      /\b(?:I|we|he|she|they|my (?:daughter|son|friend|sister|brother|partner|mother|father))\b/gi,
    ),
  ];
  return (
    !!subjects.length && /^(?:i|we)$/i.test(subjects[subjects.length - 1][0])
  );
}
function activityFrom(story: string) {
  for (const clause of clauses(story)) {
    for (const [title, pattern] of ACTIVITIES) {
      const match = clause.match(pattern);
      if (match && selfDescribedActivity(clause, match.index || 0))
        return { title, quote: clause };
    }
    // Preserve an unfamiliar activity in the person's own words rather than
    // forcing every story into our catalogue.
    const direct = clause.match(
      /^(?:I (?:was |loved |enjoyed |used to enjoy )?)?([A-Za-z]+ing\b.{2,105})$/i,
    );
    if (
      direct &&
      !negativeClaim(clause) &&
      !/^(?:being|feeling|watching|seeing|thinking|wishing|hoping|something|nothing|anything|everything|amazing|interesting|exciting)\b/i.test(
        direct[1],
      )
    ) {
      const phrase = direct[1]
        .split(/\s+(?:because|with my|with a friend|when)\b/i)[0]
        .trim();
      if (phrase.length >= 4 && phrase.length <= 100)
        return {
          title: phrase[0].toUpperCase() + phrase.slice(1),
          quote: clause,
        };
    }
  }
  return null;
}
function strengthFrom(story: string) {
  for (const clause of clauses(story)) {
    const match = clause.match(
      /\b(?:I(?:'m|’m| am) (?:good|great|skilled) at|my (?:strength|gift) is|people (?:come|turn) to me (?:for|to help (?:them )?with))\s+([^.!?;\n]{3,110})/i,
    );
    if (!match || negativeClaim(clause.slice(0, match.index))) continue;
    const title = match[1].split(/\s+(?:because|and then|when)\b/i)[0].trim();
    if (title.length > 100) continue;
    return { title: title[0].toUpperCase() + title.slice(1), quote: clause };
  }
  return null;
}
function admiredPerson(story: string) {
  const text = story.trim();
  const match = text.match(
    /^(?:I (?:really )?(?:admire|look up to|respect)\s+)?([^.!?;\n]{2,80}?)(?:,?\s+(?:for|because|who|whose)\s+|[.!]\s+)([^\n]{3,350})/i,
  );
  if (!match) return null;
  const title = match[1].trim();
  if (
    /\b(?:nobody|no one|someone|anyone|not sure|don't|do not)\b/i.test(title) ||
    title.split(/\s+/).length > 8 ||
    (!/^my\s+\w/i.test(title) &&
      !/^[A-ZÀ-Ý][\p{L}'’-]+(?:\s+[A-ZÀ-Ý][\p{L}'’-]+){0,5}$/u.test(title))
  )
    return null;
  return { title, body: match[2].trim(), quote: match[0] };
}
export function proposalKey(proposal: OnboardingProposal) {
  const evidence = proposal.evidence
    .map((e) => `${e.story_index}:${e.quote}`)
    .join("|");
  let hash = 2166136261;
  for (const letter of evidence)
    hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return `${proposal.kind}:${proposal.title.toLowerCase()}:${(hash >>> 0).toString(36)}`;
}
export function storyProposals(
  stories: OnboardingStory[],
): OnboardingProposal[] {
  const candidates: OnboardingProposal[] = [];
  stories.slice(0, 3).forEach((story, story_index) => {
    const text = [story.answer, story.follow_up || ""].join("\n");
    const evidence = (quote: string) => [{ story_index, quote }];
    if (story_index !== 2) {
      const activity = activityFrom(text);
      if (activity)
        candidates.push({
          kind: "interest",
          title: activity.title,
          body: "Something you described doing. Keep exploring it if it still draws you.",
          evidence: evidence(activity.quote),
        });
      const strength = strengthFrom(text);
      if (strength)
        candidates.push({
          kind: "strength",
          title: strength.title,
          body: "A strength you named in your own words.",
          evidence: evidence(strength.quote),
        });
    } else {
      const person = admiredPerson(text);
      if (person)
        candidates.push({
          kind: "person",
          title: person.title,
          body: person.body,
          evidence: evidence(person.quote),
        });
    }
    const value = affirmativeValues(text)[0];
    if (value)
      candidates.push({
        kind: "value",
        title: value.title,
        body: "A value to try on, if you choose it.",
        evidence: evidence(value.quote),
      });
  });
  // Keep a useful mix rather than filling the first summary with hobby cards.
  const selected: OnboardingProposal[] = [];
  for (const kind of ["interest", "person", "strength", "value"] as const) {
    const candidate = candidates.find((p) => p.kind === kind);
    if (candidate) selected.push(candidate);
  }
  for (const candidate of candidates) {
    if (selected.length >= 4) break;
    if (
      !selected.some(
        (p) =>
          p.kind === candidate.kind &&
          p.title.toLowerCase() === candidate.title.toLowerCase(),
      )
    )
      selected.push(candidate);
  }
  return selected;
}

// Network output is untrusted. A quote must occur literally in the identified
// saved story; a person's admired quality cannot become the user's strength.
export function validatedOnboardingInsights(
  raw: unknown,
  stories: OnboardingStory[],
): OnboardingInsights {
  const result: OnboardingInsights = { proposals: [], follow_up: null };
  if (!raw || typeof raw !== "object") return result;
  const value = raw as Record<string, unknown>;
  if (Array.isArray(value.proposals)) {
    for (const candidate of value.proposals.slice(0, 8)) {
      if (!candidate || typeof candidate !== "object") continue;
      const proposal = candidate as Record<string, unknown>;
      if (
        !["interest", "strength", "person", "value"].includes(
          String(proposal.kind),
        ) ||
        typeof proposal.title !== "string" ||
        !proposal.title.trim() ||
        proposal.title.length > 120 ||
        typeof proposal.body !== "string" ||
        proposal.body.length > 600 ||
        !Array.isArray(proposal.evidence) ||
        !proposal.evidence.length ||
        proposal.evidence.length > 3
      )
        continue;
      const grounded = proposal.evidence.every((piece: unknown) => {
        if (!piece || typeof piece !== "object") return false;
        const item = piece as Record<string, unknown>;
        if (
          !Number.isInteger(item.story_index) ||
          Number(item.story_index) < 0 ||
          Number(item.story_index) >= Math.min(stories.length, 3) ||
          typeof item.quote !== "string" ||
          item.quote.trim().length < 3 ||
          item.quote.length > 500
        )
          return false;
        const story = stories[Number(item.story_index)];
        return (
          story.answer.includes(item.quote) ||
          !!story.follow_up?.includes(item.quote)
        );
      });
      if (!grounded) continue;
      const typed = proposal as unknown as OnboardingProposal;
      if (
        typed.kind === "strength" &&
        typed.evidence.some((piece) => piece.story_index === 2)
      )
        continue;
      if (
        typed.kind === "interest" &&
        typed.evidence.some((piece) => piece.story_index === 2)
      )
        continue;
      if (
        typed.kind === "person" &&
        !typed.evidence.some((piece) => piece.story_index === 2)
      )
        continue;
      const knownValue = VALUE_WORDS.filter(
        ([title]) => title.toLowerCase() === typed.title.trim().toLowerCase(),
      );
      if (typed.kind === "value" && knownValue.length) {
        const quotes = typed.evidence.flatMap((piece) =>
          evidenceContexts(stories[piece.story_index], piece.quote),
        );
        const mentioned = quotes.some((quote) =>
          knownValue.some(([, pattern]) => new RegExp(pattern).test(quote)),
        );
        if (
          mentioned &&
          !quotes.some((quote) =>
            affirmativeValues(quote).some(
              (v) => v.title.toLowerCase() === typed.title.toLowerCase(),
            ),
          )
        )
          continue;
      }
      if (
        !result.proposals.some(
          (p) =>
            p.kind === typed.kind &&
            p.title.toLowerCase() === typed.title.trim().toLowerCase(),
        )
      )
        result.proposals.push({
          kind: typed.kind,
          title: typed.title.trim(),
          body: typed.body.trim(),
          evidence: typed.evidence.map((piece) => ({ ...piece })),
        });
      if (result.proposals.length === 4) break;
    }
  }
  if (value.follow_up && typeof value.follow_up === "object") {
    const followUp = value.follow_up as Record<string, unknown>;
    if (
      Number.isInteger(followUp.story_index) &&
      Number(followUp.story_index) >= 0 &&
      Number(followUp.story_index) < Math.min(stories.length, 3) &&
      !!stories[Number(followUp.story_index)].answer.trim() &&
      typeof followUp.question === "string" &&
      followUp.question.length <= 180 &&
      followUp.question.trim().endsWith("?") &&
      (followUp.question.match(/\?/g) || []).length === 1
    )
      result.follow_up = {
        story_index: Number(followUp.story_index),
        question: followUp.question.trim(),
      };
  }
  return result;
}
