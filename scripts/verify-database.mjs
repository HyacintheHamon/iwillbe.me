import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const db = new PGlite();
await db.exec(
  `create schema auth; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`,
);
const dir = new URL("../supabase/migrations/", import.meta.url).pathname;
for (const file of (await readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  try {
    await db.exec(await readFile(`${dir}/${file}`, "utf8"));
    console.log("PASS migration", file);
  } catch (e) {
    console.error(file, e.message);
    process.exit(1);
  }
}
console.log(
  (
    await db.query(
      `select (select count(*) from missions) missions,(select count(*) from night_thoughts) thoughts,(select count(*) from night_thoughts where status='verified') live_thoughts,(select count(*) from priority_words) priorities`,
    )
  ).rows,
);
await db.exec(
  `insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');insert into profiles(id) select id from auth.users;insert into missions select 'private-test','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',mission_text,first_step,area,tags,quick_picks,priorities,who_for,ladder_step,stage,size,minutes,cost,setting,safety_note,provenance,updated_at from missions limit 1;set role authenticated;select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);`,
);
if (
  (
    await db.query(
      `select count(*)::int n from missions where id='private-test'`,
    )
  ).rows[0].n !== 0
)
  throw Error("Private mission leaked");
if (
  (await db.query(`select count(*)::int n from night_thoughts`)).rows[0].n !==
  200
)
  throw Error("Unverified thought leaked");
await db.exec(
  `insert into intentions(id,user_id,day,action,value,mission_id,mission_step,for_me) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,'Read two pages','', 'starter-reading-1',1,true);`,
);
for (const sql of [
  `update intentions set mission_id='private-test' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'`,
  `insert into night_thought_history(user_id,day,snapshot) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,'{}')`,
  `update profiles set faith_tradition='Buddhist' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning id`,
]) {
  try {
    const rows = await db.query(sql);
    if (rows.rows.length) throw Error("Cross-owner mutation succeeded");
    if (!sql.startsWith("update profiles"))
      throw Error("Forbidden mutation succeeded");
  } catch (e) {
    if (e.message.includes("succeeded")) throw e;
  }
}
console.log(
  "PASS private mission isolation, thought eligibility, mission ownership, history write protection, profile ownership",
);

await db.exec(
  `select record_quick_pick('reading','pass','first-session');select record_quick_pick('reading','pass','first-session');`,
);
if (
  (
    await db.query(
      `select not_now_count n from quick_pick_responses where quick_pick_id='reading'`,
    )
  ).rows[0].n !== 1
)
  throw Error("Retry double-counted Not now");
await db.exec(`select record_quick_pick('reading','open','first-session');`);
if (
  (
    await db.query(
      `select not_now_count n from quick_pick_responses where quick_pick_id='reading'`,
    )
  ).rows[0].n !== 0
)
  throw Error("Changed choice did not reconcile Not now");
await db.exec(
  `select record_quick_pick('reading','pass','first-session');select record_quick_pick('reading','pass','later-session');`,
);
if (
  (
    await db.query(
      `select not_now_count n from quick_pick_responses where quick_pick_id='reading'`,
    )
  ).rows[0].n !== 2
)
  throw Error("Two distinct sessions not recorded");
if (
  (await db.query(`select count(*)::int n from mission_options('reading',1)`))
    .rows[0].n !== 3
)
  throw Error("Mission lookup does not respect catalogue/owner");
await db.exec(
  `update profiles set faith_tradition='Buddhist' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';reset role;delete from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';`,
);
if (
  (
    await db.query(
      `select count(*)::int n from profiles where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'`,
    )
  ).rows[0].n
)
  throw Error("Account deletion retained private profile");
console.log("PASS retry-safe quick picks, mission lookup and account deletion");
await db.close();
