import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const columns = [
  "mission_id",
  "shown",
  "picked",
  "done",
  "energy",
  "neutral",
  "drained",
  "skipped",
] as const;
type CountColumn = Exclude<(typeof columns)[number], "mission_id">;
export type MissionMetric = { mission_id: string } & Record<
  CountColumn,
  number
>;

export function validateMetricMonth(value: string): string {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new Error("Choose a month in YYYY-MM format.");
  return value;
}

export function missionMetricsCsv(payload: unknown, month: string): string {
  validateMetricMonth(month);
  if (
    !payload ||
    typeof payload !== "object" ||
    !("month" in payload) ||
    payload.month !== month ||
    !("missions" in payload) ||
    !Array.isArray(payload.missions)
  )
    throw new Error("The metrics response does not match the requested month.");
  const ids = new Set<string>();
  const rows = payload.missions.map((value: unknown) => {
    if (!value || typeof value !== "object")
      throw new Error("The metrics response contains an invalid row.");
    const row = value as Record<string, unknown>;
    if (
      Object.keys(row).length !== columns.length ||
      Object.keys(row).some(
        (key) => !columns.includes(key as (typeof columns)[number]),
      ) ||
      typeof row.mission_id !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_.#-]{0,199}$/.test(row.mission_id) ||
      ids.has(row.mission_id)
    )
      throw new Error(
        "The metrics response contains an unexpected catalogue row.",
      );
    ids.add(row.mission_id);
    for (const key of columns.slice(1)) {
      const count = row[key];
      if (
        typeof count !== "number" ||
        !Number.isSafeInteger(count) ||
        count < 0
      )
        throw new Error("The metrics response contains an invalid count.");
    }
    return columns.map((key) => String(row[key])).join(",");
  });
  return `${columns.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

async function main() {
  const [rawMonth, ...args] = process.argv.slice(2);
  if (
    !rawMonth ||
    (args.length !== 0 &&
      (args.length !== 2 || args[0] !== "--output" || !args[1]))
  )
    throw new Error(
      "Usage: node --import tsx scripts/export-mission-metrics.ts YYYY-MM [--output report.csv]",
    );
  const month = validateMetricMonth(rawMonth);
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key)
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before exporting.",
    );
  let url: URL;
  try {
    url = new URL(rawUrl);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTP or HTTPS project URL.");
  }
  const response = await fetch(
    `${url.href.replace(/\/$/, "")}/rest/v1/rpc/get_mission_recommendation_metrics`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_month: `${month}-01` }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(`Mission metrics export failed (HTTP ${response.status}).`);
  const csv = missionMetricsCsv(await response.json(), month);
  const output = resolve(args[1] || `mission-metrics-${month}.csv`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, csv, { mode: 0o600 });
  console.log(`Exported mission metrics for ${month} to ${output}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Mission metrics export failed.",
    );
    process.exitCode = 1;
  });
