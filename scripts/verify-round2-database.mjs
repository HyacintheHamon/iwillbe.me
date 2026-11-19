import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create schema auth; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key,created_at timestamptz default now()); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
);
const dir = new URL("../supabase/migrations/", import.meta.url);
let beforeRound3;
for (const file of (await readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  if (file.includes("round2"))
    await db.exec(
      `insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');insert into profiles(id) select id from auth.users;insert into journey_entries(id,user_id,kind,entry) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','interest','{"title":"reading","state":"spark","meta":{}}'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','interest','{"title":"hiking","state":"want_to_try","meta":{}}');`,
    );
  if (file.endsWith("_round3_mission_catalogue.sql")) {
    await db.exec(`
      insert into missions(id,user_id,mission_text,first_step,ladder_step,stage,size,minutes,cost)
      values('test-private-round3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','My own private step','Keep it personal',1,'Want to try','5-minute',5,'Free');
      insert into intentions(id,user_id,day,action,value,mission_id,mission_step)
      values('11111111-2222-4333-8444-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-14','A completed historical step','brave','BE-COU-1a',1);
      insert into check_ins(intention_id,user_id,outcome,reflection)
      values('11111111-2222-4333-8444-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','yes','Keep this exact reflection');
    `);
    beforeRound3 = (
      await db.query(`select
      (select array_agg(id order by id) from missions where user_id is null and active) ids,
      (select to_jsonb(m) from missions m where id='test-private-round3') private_mission,
      (select to_jsonb(i) from intentions i where id='11111111-2222-4333-8444-555555555555') intention,
      (select to_jsonb(c) from check_ins c where intention_id='11111111-2222-4333-8444-555555555555') checkin
    `)
    ).rows[0];
  }
  await db.exec(await readFile(new URL(file, dir), "utf8"));
  if (file.endsWith("_round3_mission_catalogue.sql")) {
    const after = (
      await db.query(`select
      (select array_agg(id order by id) from missions where user_id is null and active) ids,
      (select to_jsonb(m)-array['ages','family_id','theme'] from missions m where id='test-private-round3') private_mission,
      (select to_jsonb(i) from intentions i where id='11111111-2222-4333-8444-555555555555') intention,
      (select to_jsonb(c) from check_ins c where intention_id='11111111-2222-4333-8444-555555555555') checkin
    `)
    ).rows[0];
    assert.ok(beforeRound3.ids.every((id) => after.ids.includes(id)));
    assert.deepEqual(after.private_mission, beforeRound3.private_mission);
    assert.deepEqual(after.intention, beforeRound3.intention);
    assert.deepEqual(after.checkin, beforeRound3.checkin);
    assert.deepEqual(
      (await db.query("select ages from missions where id='CA-MEN-3b'")).rows[0]
        .ages,
      ["teens"],
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from missions where id like 'KK-%'",
        )
      ).rows[0].n,
      36,
    );
    assert.equal(
      (
        await db.query(
          "select count(distinct family_id)::int n from missions where id like 'KK-%'",
        )
      ).rows[0].n,
      12,
    );
    await assert.rejects(() =>
      db.exec("update missions set ages=array['adult'] where id='KK-01a'"),
    );
    await db.exec(`delete from check_ins where intention_id='11111111-2222-4333-8444-555555555555';
      delete from intentions where id='11111111-2222-4333-8444-555555555555';
      delete from missions where id='test-private-round3';`);
    console.log(
      "PASS Round 3 keeps historical IDs, private missions, completed focuses and reflections intact",
    );
  }
  console.log("PASS migration", file);
}
const one = async (sql) => (await db.query(sql)).rows[0];
assert.deepEqual(
  await one(
    `select count(*)::int total,count(*) filter(where type='learn')::int learn,count(*) filter(where id like 'SD-%')::int someday from missions where active and user_id is null`,
  ),
  { total: 1152, learn: 180, someday: 15 },
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
