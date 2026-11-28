import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
const root = new URL("../", import.meta.url);
const directory = new URL("supabase/migrations/", root);
const target = "20261128013101_round5_mission_catalogue.sql";
const metadata = JSON.parse(
  await readFile(new URL("data/round5/source.json", root), "utf8"),
);
await db.exec(`
  create schema auth;
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create table auth.users(id uuid primary key,created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
`);
for (const file of (await readdir(directory))
  .filter((file) => file.endsWith(".sql") && file < target)
  .sort()) {
  await db.exec(await readFile(new URL(file, directory), "utf8"));
}
const snapshot = async () =>
  (
    await db.query(`select
      (select jsonb_object_agg(id,to_jsonb(m)) from missions m) missions,
      (select jsonb_agg(to_jsonb(i) order by id) from intentions i) intentions,
      (select jsonb_agg(to_jsonb(c) order by intention_id) from check_ins c) checkins,
      (select jsonb_object_agg(id,to_jsonb(b)) from learning_shelf b) books,
      (select jsonb_agg(to_jsonb(p) order by position) from priority_words p) priorities
    `)
  ).rows[0];
await db.exec(`
  insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  insert into profiles(id) select id from auth.users;
  insert into missions(id,user_id,mission_text,first_step,ladder_step,stage,size,minutes,cost)
  values('BE-JOY-1a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A private collision','Keep private',1,'Want to try','5-minute',5,'Free');
`);
const migration = await readFile(new URL(target, directory), "utf8");
const collision = await snapshot();
await assert.rejects(
  () => db.exec(migration),
  /conflicts with a private mission/,
);
await db.exec("rollback;");
assert.deepEqual(await snapshot(), collision, "Rejected import must be atomic");
await db.exec(`
  delete from missions where id='BE-JOY-1a';
  insert into missions(id,user_id,mission_text,first_step,ladder_step,stage,size,minutes,cost)
  values('test-private-round5','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','My private step','Keep this exact text',1,'Want to try','5-minute',5,'Free');
  insert into intentions(id,user_id,day,action,value,mission_id,mission_step)
  values('11111111-2222-4333-8444-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-26','A completed focus','funny','BE-PLA-1a',1);
  insert into check_ins(intention_id,user_id,outcome,reflection)
  values('11111111-2222-4333-8444-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','yes','Preserve my own reflection.');
`);
const before = await snapshot();
await db.exec(migration);
const after = await snapshot();
const changed = new Set(metadata.changed_mission_ids);
for (const [id, original] of Object.entries(before.missions)) {
  if (changed.has(id)) {
    const { updated_at: oldTime, ...oldMission } = original;
    const { updated_at: newTime, ...newMission } = after.missions[id];
    assert.deepEqual(newMission, {
      ...oldMission,
      priorities: [...oldMission.priorities, "joyful"],
    });
  } else {
    assert.deepEqual(after.missions[id], original, `Unexpected change: ${id}`);
  }
}
assert.equal(
  Object.keys(after.missions).length - Object.keys(before.missions).length,
  27,
);
assert.deepEqual(after.intentions, before.intentions);
assert.deepEqual(after.checkins, before.checkins);
for (const [id, book] of Object.entries(before.books))
  assert.deepEqual(after.books[id], book);
assert.equal(Object.keys(after.books).length, 59);
assert.equal(after.priorities.length, 39);
assert.deepEqual(after.priorities.at(-1), { name: "joyful", position: 38 });
const counts = (
  await db.query(`select count(*)::int total,
    count(*) filter(where type='learn')::int learn,
    count(*) filter(where 'joyful'=any(priorities))::int joyful,
    count(*) filter(where 'adults'=any(ages))::int grown_kids
    from missions where active and user_id is null`)
).rows[0];
assert.deepEqual(counts, {
  total: 1284,
  learn: 183,
  joyful: 43,
  grown_kids: 9,
});
await db.exec(migration);
assert.deepEqual(await snapshot(), after, "Repeated import must be idempotent");
await db.close();
console.log(
  "PASS mission library v2: 1,284 missions, 39 priorities, 59 books; private data and history preserved; collision rollback and repeated import verified.",
);
