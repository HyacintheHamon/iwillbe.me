import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { EarlyAccessReport } from "../src/early-access-report";

const ADMIN = "10000000-0000-4000-8000-000000000001";
const TESTER = "20000000-0000-4000-8000-000000000002";
const OPT_OUT = "30000000-0000-4000-8000-000000000003";
const PARTIAL = "40000000-0000-4000-8000-000000000004";

test("early-access report enforces administrator isolation and reports observed local-week data", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
    `);
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(dir))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, dir), "utf8"));
    for (const [id, email, display] of [
      [ADMIN, "admin@example.test", "Administrator"],
      [TESTER, "tester@example.test", "Tester"],
      [OPT_OUT, "private@example.test", "Private participant"],
      [PARTIAL, "partial@example.test", "Partial participant"],
    ]) {
      await db.query(
        "insert into auth.users(id,email,created_at) values($1,$2,'2026-10-01T00:00:00Z')",
        [id, email],
      );
      await db.query(
        "insert into public.profiles(id,display_name,timezone,onboarded,joined_at) values($1,$2,'America/New_York',$3,'2026-10-01T00:00:00Z')",
        [id, display, id === TESTER],
      );
    }
    await db.exec(
      "update private.early_access_report_settings set instrumented_at='2026-11-02T00:00:00Z'",
    );
    let nextId = 100;
    const entry = async (
      owner: string,
      title: string,
      meta: Record<string, unknown>,
      updated = "2026-11-01T12:00:00Z",
      kind = "preferences",
      state = "active",
    ) => {
      const id = `50000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
      await db.query(
        "insert into public.journey_entries(id,user_id,kind,entry,updated_at) values($1,$2,$3,$4::jsonb,$5)",
        [
          id,
          owner,
          kind,
          JSON.stringify({
            id,
            kind,
            title,
            body: "INTIMATE FIXTURE TEXT",
            state,
            source: "fixture",
            source_ids: [],
            meta,
            created_at: updated,
            updated_at: updated,
          }),
          updated,
        ],
      );
    };
    await entry(TESTER, "Privacy", { analytics: true });
    await entry(OPT_OUT, "Privacy", { analytics: false });
    await entry(
      PARTIAL,
      "Privacy",
      { analytics: true },
      "2026-11-11T12:00:00Z",
    );
    await entry(
      PARTIAL,
      "Onboarding progress",
      { step: 7, onboarding_step: "Quick picks", cursor: 3 },
      "2026-11-12T12:00:00Z",
    );
    await entry(OPT_OUT, "Onboarding progress", {
      step: 1,
      onboarding_step: "PRIVATE ANSWER MUST NOT ESCAPE",
      cursor: 3,
    });
    await entry(
      TESTER,
      "Check-in session",
      { last_check_in_at: "2026-11-12T01:00:00Z" },
      "2026-11-12T01:00:00Z",
    );
    await entry(OPT_OUT, "Check-in session", {
      last_check_in_at: "2026-99-99T99:99:99Z",
    });
    // An invalid timezone offset raises SQLSTATE 22009, not a format error.
    await entry(OPT_OUT, "Check-in session", {
      last_check_in_at: "2026-11-12T01:00:00+24:00",
    });
    await entry(
      TESTER,
      "Night check-in completed",
      { commitment_day: "2026-11-10" },
      "2026-11-11T01:00:00Z",
      "event",
      "done",
    );
    // A duplicate marker must not count twice; malformed data must not break the report.
    await entry(
      TESTER,
      "Night check-in completed",
      { commitment_day: "2026-11-10" },
      "2026-11-11T01:00:00Z",
      "event",
      "done",
    );
    await entry(
      TESTER,
      "Night check-in completed",
      { commitment_day: "2026-99-99" },
      "2026-11-11T01:00:00Z",
      "event",
      "done",
    );
    await db.query(
      `insert into public.intentions(id,user_id,day,action,value,source,created_at)
      values('60000000-0000-4000-8000-000000000001',$1,'2026-11-09','PRIVATE FOCUS','kind','typed','2026-11-09T13:30:00Z'),
      ('60000000-0000-4000-8000-000000000002',$1,'2026-11-10','ANOTHER PRIVATE FOCUS','kind','suggested','2026-11-10T23:00:00Z')`,
      [TESTER],
    );
    await db.query(
      "insert into public.check_ins(intention_id,user_id,outcome,reflection,created_at) values('60000000-0000-4000-8000-000000000001',$1,'yes','PRIVATE REFLECTION','2026-11-10T01:00:00Z')",
      [TESTER],
    );
    await db.query(
      `insert into public.checkin_summaries(user_id,day,session_id,summary,created_at) values
      ($1,'2026-11-09','night:one','PRIVATE SUMMARY','2026-11-10T01:00:00Z'),
      ($1,'2026-11-12','night:two','PRIVATE SUMMARY','2026-11-13T01:00:00Z')`,
      [TESTER],
    );
    for (const [owner, event, when] of [
      [TESTER, "my_map_opened", "2026-11-09T04:59:00Z"], // Previous Sunday in New York: excluded.
      [TESTER, "my_map_opened", "2026-11-09T05:00:00Z"], // Monday local midnight: included.
      [TESTER, "sunday_review_opened", "2026-11-16T04:30:00Z"], // Sunday local night: included.
      [TESTER, "future_me_opened", "2026-11-16T05:00:00Z"], // Next Monday: excluded.
      [OPT_OUT, "my_map_opened", "2026-11-10T15:00:00Z"], // Revoked consent hides even older events.
      [PARTIAL, "my_map_opened", "2026-11-12T15:00:00Z"],
    ])
      await db.query(
        "insert into public.product_events(user_id,event,created_at) values($1,$2,$3)",
        [owner, event, when],
      );

    const actAs = async (role: string, owner = "") => {
      await db.exec(`reset role; set role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        owner,
      ]);
    };
    const report = async (day = "2026-11-09") =>
      (
        await db.query<{ report: EarlyAccessReport }>(
          "select public.get_early_access_report($1::date) as report",
          [day],
        )
      ).rows[0].report;

    await t.test(
      "anonymous and ordinary accounts cannot call the report or grant themselves access",
      async () => {
        await actAs("anon");
        await assert.rejects(() => report(), /permission denied/);
        await actAs("authenticated", TESTER);
        await assert.rejects(() => report(), /only to its administrator/);
        await assert.rejects(
          () => db.query("select private.early_access_report('2026-11-09')"),
          /only to its administrator/,
        );
        assert.equal(
          (await db.query("select * from public.early_access_report_admins"))
            .rows.length,
          0,
        );
        await assert.rejects(
          () =>
            db.query(
              "insert into public.early_access_report_admins(user_id) values($1)",
              [TESTER],
            ),
          /permission denied/,
        );
        await assert.rejects(
          () => db.query("select * from private.early_access_report_settings"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "a trusted service provisions access while all journal policies remain private",
      async () => {
        await actAs("service_role");
        await db.query(
          "insert into public.early_access_report_admins(user_id) values($1)",
          [ADMIN],
        );
        await actAs("authenticated", ADMIN);
        assert.equal(
          (await db.query("select * from public.early_access_report_admins"))
            .rows.length,
          1,
        );
        assert.equal(
          (await db.query("select * from public.intentions")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.check_ins")).rows.length,
          0,
        );
        await assert.rejects(() => report("2026-11-10"), /Choose a Monday/);
      },
    );
    await t.test(
      "the report counts local days, merges no-focus nights and never returns intimate text",
      async () => {
        const result = await report();
        const tester = result.participants.find(
          (row) => row.user_id === TESTER,
        )!;
        assert.equal(tester.focus_days, 2);
        assert.equal(tester.mornings_with_focus, 1);
        assert.equal(tester.typed_focuses, 1);
        assert.equal(tester.suggested_focuses, 1);
        assert.equal(tester.night_checkins, 4);
        assert.equal(tester.my_map_opened, 1);
        assert.equal(tester.sunday_review_opened, 1);
        assert.equal(tester.future_me_opened, 0);
        assert.equal(tester.last_active_day, "2026-11-15");
        assert.equal(tester.onboarding_complete, true);
        assert.equal(tester.onboarding_step, "Completed");
        assert.equal(tester.screen_metrics_status, "collected");
        const exported = JSON.stringify(result);
        assert.ok(!exported.includes("PRIVATE"));
        assert.ok(!exported.includes("INTIMATE"));
      },
    );
    await t.test(
      "opt-out, partial collection and uninstrumented history are unknown instead of false zeroes",
      async () => {
        const result = await report();
        const optedOut = result.participants.find(
          (row) => row.user_id === OPT_OUT,
        )!;
        assert.equal(optedOut.screen_metrics_status, "not_collected");
        assert.equal(optedOut.my_map_opened, null);
        assert.equal(optedOut.onboarding_step, null);
        assert.equal(optedOut.night_checkins, 0);
        const partial = result.participants.find(
          (row) => row.user_id === PARTIAL,
        )!;
        assert.equal(partial.screen_metrics_status, "partial");
        assert.equal(partial.my_map_opened, 1);
        assert.equal(partial.future_me_opened, null);
        assert.equal(partial.sunday_review_opened, null);
        assert.equal(partial.onboarding_step, "Quick picks");
        assert.equal(partial.onboarding_cursor, 4);
        const historical = (await report("2026-10-19")).participants.find(
          (row) => row.user_id === TESTER,
        )!;
        assert.equal(historical.screen_metrics_status, "not_collected");
        assert.equal(historical.my_map_opened, null);
        assert.equal(historical.night_checkins, null);
        assert.equal(historical.night_checkins_coverage, "observed");
      },
    );
    await t.test(
      "revoking the whitelist immediately closes both callable paths",
      async () => {
        await actAs("service_role");
        await db.query(
          "delete from public.early_access_report_admins where user_id=$1",
          [ADMIN],
        );
        await actAs("authenticated", ADMIN);
        await assert.rejects(() => report(), /only to its administrator/);
        await assert.rejects(
          () => db.query("select private.early_access_report('2026-11-09')"),
          /only to its administrator/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
