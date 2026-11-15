import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create schema auth; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key,created_at timestamptz default now()); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
);
const dir = new URL("../supabase/migrations/", import.meta.url);
for (const file of (await readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (file.includes("round2"))
    await db.exec(
      `insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');insert into profiles(id) select id from auth.users;insert into journey_entries(id,user_id,kind,entry) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','interest','{"title":"reading","state":"spark","meta":{}}'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','interest','{"title":"hiking","state":"want_to_try","meta":{}}');`,
    );
  await db.exec(await readFile(new URL(file, dir), "utf8"));
  console.log("PASS migration", file);
}
const one = async (sql) => (await db.query(sql)).rows[0];
assert.deepEqual(
  await one(
    `select count(*)::int total,count(*) filter(where type='learn')::int learn,count(*) filter(where id like 'SD-%')::int someday from missions where active and user_id is null`,
  ),
  { total: 1089, learn: 180, someday: 15 },
);
assert.equal((await one("select count(*)::int n from learning_shelf")).n, 56);
assert.equal((await one("select count(*)::int n from interest_links")).n, 44);
assert.deepEqual(
  (
    await db.query(
      `select entry->>'state' state from journey_entries order by id`,
    )
  ).rows.map((x) => x.state),
  ["want_to_try", "from_time_to_time"],
);
await db.exec(
  `insert into places(user_id,label) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','private place');insert into someday_items(id,user_id,text,horizon) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Private dream','this_year');set role authenticated;select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);`,
);
assert.equal((await one("select count(*)::int n from places")).n, 0);
assert.equal((await one("select count(*)::int n from someday_items")).n, 0);
await assert.rejects(() =>
  db.exec(
    `insert into places(user_id,label) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','forged')`,
  ),
);
await assert.rejects(() =>
  db.exec(
    `insert into intentions(user_id,day,action,value,someday_item_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,'test','', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')`,
  ),
);
await assert.rejects(() =>
  db.exec(
    `select reserve_chloe_moment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','learning','session')`,
  ),
);
await db.exec(
  `insert into places(user_id,label) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','with friends');insert into someday_items(user_id,text,horizon) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Visit Japan','five_years');`,
);
assert.equal((await one("select count(*)::int n from places")).n, 1);
console.log(
  "PASS full catalogue, old-stage conversion, owner isolation, cross-owner links and service-only moments",
);
// Replacement is atomic: invalid new content leaves the reflected focus intact.
await db.exec(
  `insert into intentions(id,user_id,day,action,value) values('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,'Earlier action','kind');insert into check_ins(intention_id,user_id,outcome,reflection) values('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','yes','A good conversation');`,
);
await assert.rejects(() =>
  db.exec(
    `select replace_daily_focus('ffffffff-ffff-4fff-8fff-ffffffffffff',1,'{"action":"","source":"bad"}')`,
  ),
);
assert.equal((await one("select count(*)::int n from check_ins")).n, 1);
await db.exec(
  `select replace_daily_focus('ffffffff-ffff-4fff-8fff-ffffffffffff',1,'{"action":"New action","source":"typed"}')`,
);
assert.equal((await one("select count(*)::int n from check_ins")).n, 0);
assert.equal(
  (
    await one(
      "select count(*)::int n from journey_entries where entry->>'state'='replaced'",
    )
  ).n,
  1,
);
assert.equal((await one("select revision from intentions")).revision, 2);
await assert.rejects(() =>
  db.exec(
    `select replace_daily_focus('ffffffff-ffff-4fff-8fff-ffffffffffff',1,'{"action":"Stale overwrite"}')`,
  ),
);
console.log(
  "PASS atomic replacement, preserved reflection and stale revision rejection",
);
await db.exec("reset role");
await db.exec(
  await readFile(
    new URL("../tests/onboarding-completion.sql", import.meta.url),
    "utf8",
  ),
);
console.log(
  "PASS final onboarding save, ten priorities, skipped answers and owner isolation",
);
await db.close();
