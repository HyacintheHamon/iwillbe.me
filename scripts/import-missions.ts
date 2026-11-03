import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  missionTag,
  type Mission,
} from "../supabase/functions/_shared/missions";

export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += ch;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  const header =
    rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) || [];
  return rows.map((r, i) => {
    if (r.length !== header.length)
      throw Error(`CSV row ${i + 2}: expected ${header.length} columns`);
    return Object.fromEntries(header.map((h, j) => [h, r[j]]));
  });
}
export function normalizeMissions(rows: Record<string, unknown>[]): Mission[] {
  const ids = new Set<string>();
  return rows.map((input, index) => {
    const row = Object.fromEntries(
      Object.entries(input).map(([k, v]) => [
        k.toLowerCase().replace(/[^a-z0-9]/g, ""),
        v,
      ]),
    );
    const get = (...keys: string[]) =>
      keys.map((k) => row[k]).find((v) => v !== undefined) ?? "";
    const list = (value: unknown) =>
      (Array.isArray(value) ? value : String(value).split(";"))
        .map((v) => missionTag(String(v)))
        .filter(Boolean);
    const id = String(get("id")).trim();
    const sizeRaw = String(get("size")).trim().toLowerCase();
    const size = (
      {
        "5-minute": "5-minute",
        "5 minutes": "5-minute",
        "5-minute mission": "5-minute",
        normal: "Normal",
        stretch: "Stretch",
      } as Record<string, Mission["size"]>
    )[sizeRaw];
    const mission = {
      id,
      user_id: null,
      mission_text: String(get("missiontext", "mission")).trim(),
      first_step: String(get("firststep")).trim(),
      area: String(get("area")).trim(),
      tags: list(get("tags")),
      quick_picks: list(get("quickpicks")),
      priorities: list(get("priorities")),
      who_for: list(get("whofor", "whoitsfor", "whoforbeneficiary")),
      ladder_step: Number(get("ladderstep")),
      stage: String(get("stage"))
        .trim()
        .replace(/^Tried it$/, "Want to try"),
      size,
      minutes: Number(get("minutes")),
      cost: String(get("cost")).trim(),
      setting: String(get("setting")).trim(),
      safety_note: String(get("safetynote")).trim(),
      provenance: "Kelly mission library",
    };
    const fail = (reason: string) => {
      throw Error(`Row ${index + 2} (${id || "missing ID"}): ${reason}`);
    };
    if (!id || ids.has(id)) fail("missing or duplicate ID");
    ids.add(id);
    if (
      !mission.mission_text ||
      mission.mission_text.length > 500 ||
      !mission.first_step ||
      mission.first_step.length > 500
    )
      fail("mission text and first step must be 1–500 characters");
    if (!["Be", "People", "Causes", "Passions", "Grow"].includes(mission.area))
      fail("unknown area");
    if (
      !Number.isInteger(mission.ladder_step) ||
      mission.ladder_step < 1 ||
      mission.ladder_step > 5
    )
      fail("ladder step must be 1–5");
    if (
      !["Maybe", "Want to try", "Into it", "All in"].includes(mission.stage) ||
      !size
    )
      fail("unknown stage or size");
    if (
      !Number.isInteger(mission.minutes) ||
      mission.minutes < 1 ||
      mission.minutes > 180 ||
      !["Free", "$", "$$"].includes(mission.cost)
    )
      fail("invalid minutes or cost");
    if (
      !mission.tags.length &&
      !mission.quick_picks.length &&
      !mission.priorities.length
    )
      fail("at least one interest or priority tag is required");
    return mission as Mission;
  });
}
async function main() {
  const file = process.argv[2];
  if (!file)
    throw Error(
      "Usage: npm run missions:import -- file.csv [--apply] [--output file.json]",
    );
  const raw = await readFile(file, "utf8");
  const rows = file.endsWith(".json") ? JSON.parse(raw) : parseCSV(raw);
  if (!Array.isArray(rows) || !rows.length)
    throw Error("Empty mission library");
  const missions = normalizeMissions(rows);
  const out = process.argv.indexOf("--output");
  if (out >= 0)
    await writeFile(
      process.argv[out + 1],
      JSON.stringify(missions, null, 2) + "\n",
    );
  console.log(
    `Validated ${missions.length} missions; ${new Set(missions.flatMap((m) => [...m.tags, ...m.quick_picks, ...m.priorities])).size} tags.`,
  );
  if (!process.argv.includes("--apply"))
    return console.log("Validation only. No database changed.");
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before --apply",
    );
  // A single PostgREST statement is transactional: a rejected row rolls back the whole import.
  const response = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/missions?on_conflict=id`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(missions),
    },
  );
  if (!response.ok)
    throw Error(
      `Import rejected (${response.status}); no partial import was applied.`,
    );
  console.log(
    `Imported ${missions.length} missions. Matching IDs were updated; private missions and history were retained.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
