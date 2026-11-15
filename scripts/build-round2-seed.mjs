import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const missions = JSON.parse(
  await readFile(new URL("data/round2/missions.json", root), "utf8"),
);
const links = JSON.parse(
  await readFile(new URL("data/round2/interest-links.json", root), "utf8"),
);
const shelf = JSON.parse(
  await readFile(new URL("data/round2/learning-shelf.json", root), "utf8"),
);
const path = new URL(
  "supabase/migrations/20261115040953_round2_focus_and_library.sql",
  root,
);
let sql = (await readFile(path, "utf8")).split("-- ROUND2 CATALOGUE SEED")[0];
sql +=
  "-- ROUND2 CATALOGUE SEED — generated from the supplied workbook; do not hand-edit.\n";
// Reuse an existing ID if text is unchanged. Catalogue IDs are also retained as tags.
sql += `create temporary table round2_missions as select * from jsonb_populate_recordset(null::public.missions,$seed$${JSON.stringify(missions)}$seed$);\n`;
sql += `update round2_missions n set id=o.id from public.missions o where o.user_id is null and o.mission_text=n.mission_text and o.size=n.size;\n`;
const cols = Object.keys(missions[0]);
sql += `insert into public.missions(${cols.join(",")}) select ${cols.join(",")} from round2_missions on conflict(id) do update set ${cols
  .filter((c) => c !== "id")
  .map((c) => `${c}=excluded.${c}`)
  .join(",")};\ndrop table round2_missions;\n`;
for (const [table, rows] of [
  ["interest_links", links],
  ["learning_shelf", shelf],
]) {
  const fields = Object.keys(rows[0]);
  sql += `insert into public.${table}(${fields.join(",")}) select ${fields.join(",")} from jsonb_populate_recordset(null::public.${table},$seed$${JSON.stringify(rows)}$seed$);\n`;
}
await writeFile(path, sql);
console.log("Round 2 migration seed built");
