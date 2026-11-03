import type { Practice } from "./domain";
export const BENEFICIARY_GROUPS = [
  "Family",
  "Friends",
  "Colleagues",
  "Community",
  "For me",
];
export function beneficiaries(data: Practice) {
  return [
    ...new Set(
      [...data.intentions]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((i) => i.for_whom || i.person)
        .filter(
          (n) =>
            n &&
            !BENEFICIARY_GROUPS.some(
              (g) => g.toLowerCase() === n.toLowerCase(),
            ) &&
            !/^(me|myself)$/i.test(n),
        ),
    ),
    ...BENEFICIARY_GROUPS,
  ];
}
export function detectBeneficiary(action: string, people: string[]) {
  const text = action.toLowerCase();
  for (const person of people) {
    if (BENEFICIARY_GROUPS.includes(person)) continue;
    const escaped = person.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`).test(text))
      return { name: person, match: person };
  }
  for (const [pattern, name] of [
    [/\b(?:my |our )?community\b/i, "Community"],
    [/\b(?:my |our )?family\b/i, "Family"],
    [/\b(?:my |our )?friends\b/i, "Friends"],
    [/\b(?:my |our )?colleagues\b/i, "Colleagues"],
    [/\b(?:for me|for myself)\b/i, "For me"],
  ] as const) {
    const match = action.match(pattern);
    if (match) return { name, match: match[0] };
  }
  return null;
}
