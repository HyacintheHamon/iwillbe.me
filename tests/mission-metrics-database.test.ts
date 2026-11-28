import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  missionMetricsCsv,
  validateMetricMonth,
  type MissionMetric,
} from "../scripts/export-mission-metrics";

const OWNER = "10000000-0000-4000-8000-000000000001";
const NO_CONSENT = "20000000-0000-4000-8000-000000000002";
const OPT_OUT = "30000000-0000-4000-8000-000000000003";
const STRING_CONSENT = "40000000-0000-4000-8000-000000000004";
const SECOND_OWNER = "50000000-0000-4000-8000-000000000005";
const TIED_CONSENT = "60000000-0000-4000-8000-000000000006";
const MISSION = "BE-COU-1a";
const UNSEEN = "BE-COU-1b";
const PRIVATE = "personal-private-mission";
const SECRET = "PERSONAL JOURNAL TEXT MUST NEVER BE EXPORTED";
const emptyCounts = {
  shown: 0,
  picked: 0,
  done: 0,
  energy: 0,
  neutral: 0,
  drained: 0,
  skipped: 0,
};
type MetricsReport = {
  month: string;
  month_start: string;
  month_end_exclusive: string;
  missions: MissionMetric[];
};

test("monthly mission metrics respect consent, local days and service-role isolation", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
    `);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    for (const owner of [
      OWNER,
      NO_CONSENT,
      OPT_OUT,
      STRING_CONSENT,
      SECOND_OWNER,
      TIED_CONSENT,
    ]) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        owner,
        `${owner}@example.test`,
      ]);
      await db.query(
        "insert into profiles(id,timezone) values($1,'America/New_York')",
        [owner],
      );
    }
    await db.query(
      "insert into early_access_report_admins(user_id) values($1)",
      [OWNER],
    );
    await db.query(
      `
      insert into missions(id,user_id,mission_text,first_step,ladder_step,stage,size,minutes,cost)
      values($1,$2,$3,'Keep private',1,'Want to try','5-minute',5,'Free')
    `,
      [PRIVATE, OWNER, SECRET],
    );
    // Inactive public missions still need historical reporting and zero rows.
    await db.query("update missions set active=false where id=$1", [UNSEEN]);

    let nextId = 100;
    const entry = async (
      owner: string,
      meta: Record<string, unknown>,
      title = "Mission feedback",
      kind = "event",
      updated = "2026-12-10T12:00:00Z",
    ) => {
      const id = `70000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
      await db.query(
        "insert into journey_entries(id,user_id,kind,entry,updated_at) values($1,$2,$3,$4::jsonb,$5)",
        [
          id,
          owner,
          kind,
          JSON.stringify({ id, kind, title, body: SECRET, meta }),
          updated,
        ],
      );
      return id;
    };
    const privacy = (
      owner: string,
      analytics: unknown,
      updated = "2026-10-01T00:00:00Z",
    ) => entry(owner, { analytics }, "Privacy", "preferences", updated);
    await privacy(OWNER, true);
    await privacy(OPT_OUT, true);
    await privacy(OPT_OUT, false, "2026-11-20T00:00:00Z");
    await privacy(STRING_CONSENT, "true");
    await privacy(SECOND_OWNER, true);
    await privacy(TIED_CONSENT, true);
    await privacy(TIED_CONSENT, false); // same timestamp, later stable ID wins
    const feedback = (
      owner: string,
      outcome: string,
      day: string,
      surface = "today",
      mission = MISSION,
    ) =>
      entry(owner, {
        outcome,
        mission_id: mission,
        feedback_day: day,
        surface,
      });

    for (const surface of ["today", "onboarding", "today-rerender"])
      await feedback(OWNER, "shown", "2026-11-02", surface);
    for (const surface of ["today", "onboarding"]) {
      await feedback(OWNER, "picked", "2026-11-02", surface);
      await feedback(OWNER, "passed", "2026-11-02", surface);
    }
    await feedback(OWNER, "shown", "2026-11-03");
    await feedback(OWNER, "picked", "2026-11-04");
    await feedback(OWNER, "shown", "2026-11-30");
    await feedback(OWNER, "shown", "2026-10-31");
    await feedback(OWNER, "shown", "2026-12-01");
    await feedback(SECOND_OWNER, "shown", "2026-11-02");
    await feedback(SECOND_OWNER, "picked", "2026-11-02");
    for (const owner of [NO_CONSENT, OPT_OUT, STRING_CONSENT, TIED_CONSENT])
      for (const outcome of ["shown", "picked", "passed"])
        await feedback(owner, outcome, "2026-11-02");
    for (const day of ["2026-11-31", "2026-11-02T10:00:00Z", "", "not-a-day"])
      await feedback(OWNER, "shown", day);
    await feedback(OWNER, "invented", "2026-11-06");
    await feedback(OWNER, "shown", "2026-11-06", "today", PRIVATE);
    await feedback(OWNER, "shown", "2026-11-06", "today", "unknown-mission");
    await entry(
      OWNER,
      { outcome: "shown", mission_id: MISSION, feedback_day: "2026-11-06" },
      "Other event",
    );
    await entry(
      OWNER,
      { outcome: "shown", mission_id: MISSION, feedback_day: "2026-11-06" },
      "Mission feedback",
      "story",
    );
    await entry(OWNER, { outcome: "shown", mission_id: MISSION }); // legacy, no local day

    const focus = async (
      owner: string,
      day: string,
      outcome: string,
      energy: string | null,
      mission = MISSION,
      createdAt = "2026-12-10T01:00:00Z",
    ) => {
      const id = `80000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
      await db.query(
        "insert into intentions(id,user_id,day,action,value,mission_id,mission_step,created_at) values($1,$2,$3,$4,'brave',$5,1,$6)",
        [id, owner, day, SECRET, mission, createdAt],
      );
      await db.query(
        "insert into check_ins(intention_id,user_id,outcome,reflection,energy,created_at) values($1,$2,$3,$4,$5,$6)",
        [id, owner, outcome, SECRET, energy, createdAt],
      );
    };
    await focus(OWNER, "2026-11-03", "yes", "neutral");
    await focus(OWNER, "2026-11-04", "not_yet", "lit");
    await focus(OWNER, "2026-11-05", "partly", "drained");
    await focus(
      OWNER,
      "2026-11-30",
      "yes",
      null,
      MISSION,
      "2026-12-01T03:00:00Z",
    );
    await focus(
      OWNER,
      "2026-10-31",
      "yes",
      "lit",
      MISSION,
      "2026-11-01T03:00:00Z",
    );
    await focus(
      OWNER,
      "2026-12-01",
      "yes",
      "neutral",
      MISSION,
      "2026-11-30T23:00:00Z",
    );
    await focus(OWNER, "2026-11-07", "yes", "lit", PRIVATE);
    await focus(SECOND_OWNER, "2026-11-02", "yes", "lit");
    for (const owner of [NO_CONSENT, OPT_OUT, STRING_CONSENT, TIED_CONSENT])
      await focus(owner, "2026-11-08", "yes", "lit");

    const report = async (month = "2026-11-01") => {
      await db.exec("reset role; set role service_role;");
      try {
        const response = await db.query<{ report: MetricsReport }>(
          "select public.get_mission_recommendation_metrics($1::date) as report",
          [month],
        );
        return response.rows[0].report;
      } finally {
        await db.exec("reset role;");
      }
    };
    await t.test(
      "ordinary users and report administrators cannot access either function",
      async () => {
        await assert.rejects(
          () =>
            db.query(
              "select private.mission_recommendation_metrics('2026-11-01')",
            ),
          /service role/,
        );
        await db.exec("set role anon;");
        await assert.rejects(
          () =>
            db.query("select get_mission_recommendation_metrics('2026-11-01')"),
          /permission denied/,
        );
        await db.exec("reset role; set role authenticated;");
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          OWNER,
        ]);
        await db.exec(
          "select set_config('request.jwt.claim.role','service_role',false);",
        );
        await assert.rejects(
          () =>
            db.query("select get_mission_recommendation_metrics('2026-11-01')"),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            db.query(
              "select private.mission_recommendation_metrics('2026-11-01')",
            ),
          /permission denied/,
        );
        // Even a mistaken future ACL cannot bypass the role guard in the definer.
        await db.exec(
          "reset role; grant execute on function private.mission_recommendation_metrics(date) to authenticated; set role authenticated;",
        );
        await assert.rejects(
          () =>
            db.query(
              "select private.mission_recommendation_metrics('2026-11-01')",
            ),
          /service role/,
        );
        await db.exec(
          "reset role; revoke all on function private.mission_recommendation_metrics(date) from authenticated;",
        );
      },
    );
    await t.test(
      "deduplicates impressions and actions while keeping energy independent",
      async () => {
        const result = await report();
        assert.equal(result.month, "2026-11");
        assert.equal(result.month_start, "2026-11-01");
        assert.equal(result.month_end_exclusive, "2026-12-01");
        assert.deepEqual(
          result.missions.find((row) => row.mission_id === MISSION),
          {
            mission_id: MISSION,
            shown: 4,
            picked: 3,
            done: 3,
            energy: 2,
            neutral: 1,
            drained: 1,
            skipped: 1,
          },
        );
        assert.deepEqual(
          result.missions.find((row) => row.mission_id === UNSEEN),
          { mission_id: UNSEEN, ...emptyCounts },
        );
        const count = await db.query<{ n: number }>(
          "select count(*)::int n from missions where user_id is null",
        );
        assert.equal(result.missions.length, count.rows[0].n);
        assert.ok(
          result.missions.length > 1000,
          "The full catalogue is in a single JSON result",
        );
        for (const row of result.missions)
          assert.deepEqual(
            Object.keys(row).sort(),
            ["mission_id", ...Object.keys(emptyCounts)].sort(),
          );
        const serialized = JSON.stringify(result);
        for (const forbidden of [
          OWNER,
          NO_CONSENT,
          OPT_OUT,
          SECRET,
          PRIVATE,
          "unknown-mission",
          "@example.test",
        ])
          assert.ok(
            !serialized.includes(forbidden),
            `Report leaked ${forbidden}`,
          );
        assert.equal(
          missionMetricsCsv(result, "2026-11").trim().split("\n").length,
          result.missions.length + 1,
        );
      },
    );
    await t.test(
      "uses the focus local day rather than record creation time",
      async () => {
        assert.deepEqual(
          (await report("2026-10-01")).missions.find(
            (row) => row.mission_id === MISSION,
          ),
          {
            mission_id: MISSION,
            ...emptyCounts,
            shown: 1,
            done: 1,
            energy: 1,
          },
        );
        assert.deepEqual(
          (await report("2026-12-01")).missions.find(
            (row) => row.mission_id === MISSION,
          ),
          {
            mission_id: MISSION,
            ...emptyCounts,
            shown: 1,
            done: 1,
            neutral: 1,
          },
        );
        await assert.rejects(() => report("2026-11-02"), /first day/);
        await assert.rejects(() => report("infinity"), /first day/);
      },
    );
    await t.test(
      "a new opt-out removes that person's counts from past months too",
      async () => {
        await privacy(OWNER, false, "2027-01-01T00:00:00Z");
        const result = await report();
        assert.deepEqual(
          result.missions.find((row) => row.mission_id === MISSION),
          {
            mission_id: MISSION,
            ...emptyCounts,
            shown: 1,
            picked: 1,
            done: 1,
            energy: 1,
          },
        );
        assert.deepEqual(
          (await report("2026-10-01")).missions.find(
            (row) => row.mission_id === MISSION,
          ),
          {
            mission_id: MISSION,
            ...emptyCounts,
          },
        );
      },
    );
  } finally {
    await db.close();
  }
});

test("metrics CSV validates the month and exports only catalogue IDs and counts", () => {
  const payload = {
    month: "2026-11",
    missions: [{ mission_id: MISSION, ...emptyCounts, shown: 2 }],
  };
  assert.equal(validateMetricMonth("2026-11"), "2026-11");
  for (const value of [
    "2026-1",
    "2026-00",
    "2026-13",
    "0000-11",
    "2026-11-01",
    "2026-11\n",
    "anything",
  ])
    assert.throws(() => validateMetricMonth(value), /YYYY-MM/);
  assert.equal(
    missionMetricsCsv(payload, "2026-11"),
    "mission_id,shown,picked,done,energy,neutral,drained,skipped\nBE-COU-1a,2,0,0,0,0,0,0\n",
  );
  assert.throws(() => missionMetricsCsv(payload, "2026-12"), /requested month/);
  assert.throws(
    () =>
      missionMetricsCsv(
        { ...payload, missions: [{ ...payload.missions[0], body: SECRET }] },
        "2026-11",
      ),
    /unexpected catalogue row/,
  );
  assert.throws(
    () =>
      missionMetricsCsv(
        {
          ...payload,
          missions: [
            { ...payload.missions[0], mission_id: '=HYPERLINK("secret")' },
          ],
        },
        "2026-11",
      ),
    /unexpected catalogue row/,
  );
  assert.throws(
    () =>
      missionMetricsCsv(
        { ...payload, missions: [{ ...payload.missions[0], shown: -1 }] },
        "2026-11",
      ),
    /invalid count/,
  );
  assert.throws(
    () =>
      missionMetricsCsv(
        { ...payload, missions: [...payload.missions, ...payload.missions] },
        "2026-11",
      ),
    /unexpected catalogue row/,
  );
});
