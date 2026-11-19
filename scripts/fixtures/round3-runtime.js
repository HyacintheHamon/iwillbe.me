/* Isolated browser fixture, injected only by build-round3-fixture.mjs. */
(() => {
  "use strict";
  const catalogue = window.__ROUND3_QA_DATA__;
  if (!catalogue)
    throw new Error("QA data is missing; no live service is enabled.");
  const realFetch = window.fetch.bind(window);
  const RealDate = window.Date;
  const query = new URLSearchParams(location.search);
  const scenarios = new Set([
    "morning",
    "evening",
    "new",
    "offline-night",
    "admin-denied",
    "admin-allowed",
  ]);
  const requested =
    query.get("qaScenario") ||
    sessionStorage.getItem("round3.qa.scenario") ||
    "morning";
  const scenario = scenarios.has(requested) ? requested : "morning";
  const resetToken =
    query.get("qaReset") ||
    sessionStorage.getItem("round3.qa.reset") ||
    "initial";
  const clock = ["evening", "offline-night"].includes(scenario)
    ? "2026-11-19T23:00:00Z"
    : "2026-11-19T14:00:00Z";
  const clockMs = RealDate.parse(clock);
  function FixtureDate(...args) {
    if (!new.target) return new RealDate(clockMs).toString();
    return Reflect.construct(
      RealDate,
      args.length ? args : [clockMs],
      new.target,
    );
  }
  Object.setPrototypeOf(FixtureDate, RealDate);
  FixtureDate.prototype = RealDate.prototype;
  FixtureDate.now = () => clockMs;
  window.Date = FixtureDate;
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const now = () => new RealDate(clockMs).toISOString();
  const uuid = () => crypto.randomUUID();
  const stateKey = "round3.qa.database.v1";
  const configuredHost = new URL(catalogue.supabaseUrl).hostname;
  const authKey = `sb-${configuredHost.split(".")[0]}-auth-token`;
  const user = {
    id: owner,
    aud: "authenticated",
    role: "authenticated",
    email: "taylor@example.test",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-11-02T14:00:00Z",
  };
  const expiry = Math.floor(clockMs / 1000) + 365 * 86400;
  const encode = (value) =>
    btoa(JSON.stringify(value))
      .replaceAll("=", "")
      .replaceAll("+", "-")
      .replaceAll("/", "_");
  const session = {
    user,
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: owner, role: "authenticated", exp: expiry })}.fixture`,
    refresh_token: "local-fixture",
    token_type: "bearer",
    expires_at: expiry,
    expires_in: 365 * 86400,
  };
  const profile = () => ({
    id: owner,
    revision: 1,
    display_name: "Taylor",
    faith_tradition: null,
    joined_at: user.created_at,
    baseline_answers: [5, 6, 7],
    north_star: "Make time for my family",
    values: [],
    interests: [],
    onboarded: scenario !== "new",
    timezone: "America/New_York",
    morning_time: "08:00",
    evening_time: "20:30",
  });
  function entry(kind, title, state = "active", body = "", meta = {}) {
    const id = uuid();
    return {
      id,
      user_id: owner,
      kind,
      revision: 1,
      updated_at: now(),
      entry: {
        id,
        kind,
        title,
        state,
        body,
        meta,
        source: "Fictional QA fixture",
        source_ids: [],
        created_at: now(),
        updated_at: now(),
      },
    };
  }
  function seed() {
    const db = {
      profiles: [profile()],
      intentions: [],
      check_ins: [],
      memories: [],
      messages: [],
      journey_entries: [],
      places: [],
      someday_items: [],
      chloe_moments: [],
      checkin_summaries: [],
      support_state: [],
      quick_pick_responses: [],
      product_events: [],
      missions: [],
      friend_suggestions: [],
      shared_invitations: [],
      product_feedback: [],
    };
    if (scenario !== "new") {
      for (const [kind, title, state] of [
        ["value", "kind", "working_on"],
        ["value", "healthy", "working_on"],
        ["value", "patient", "working_on"],
        ["value", "curious", "important"],
        ["value", "creative", "important"],
        ["interest", "reading", "into_it"],
        ["interest", "hiking", "into_it"],
        ["interest", "cooking for friends", "into_it"],
        ["interest", "gardening", "want_to_try"],
      ])
        db.journey_entries.push(entry(kind, title, state));
      db.journey_entries.push(
        entry(
          "why",
          "My why",
          "accepted",
          "Make time for the people I love, and bring a little kindness into ordinary days.",
        ),
      );
      db.journey_entries.push(
        entry("preferences", "Kids ages", "active", "under 6", {
          ages: ["under 6"],
          asked: true,
        }),
      );
      db.journey_entries.push(
        entry("preferences", "Privacy", "active", "", { analytics: true }),
      );
      db.places.push(
        {
          id: uuid(),
          user_id: owner,
          label: "with my kids",
          sort_order: 0,
          created_at: now(),
        },
        {
          id: uuid(),
          user_id: owner,
          label: "at home",
          sort_order: 1,
          created_at: now(),
        },
      );
      for (const [text, horizon] of [
        ["Visit Japan", "this_year"],
        ["Learn to play the piano", "five_years"],
        ["Create a garden", "ten_years"],
        ["Walk the Camino", "later_in_life"],
      ])
        db.someday_items.push({
          id: uuid(),
          user_id: owner,
          text,
          horizon,
          status: "open",
          revision: 1,
          created_at: now(),
          updated_at: now(),
        });
    }
    return { scenario, resetToken, signedIn: true, db };
  }
  let store;
  try {
    store = JSON.parse(localStorage.getItem(stateKey) || "null");
  } catch {
    store = null;
  }
  if (
    !store ||
    store.scenario !== scenario ||
    store.resetToken !== resetToken
  ) {
    for (const key of Object.keys(localStorage))
      if (
        key.startsWith("iwillbe.") ||
        /^sb-.*-auth-token/.test(key) ||
        key.startsWith("round3.qa.")
      )
        localStorage.removeItem(key);
    store = seed();
    const initial = {
      profile: store.db.profiles[0],
      intentions: [],
      checkIns: [],
      memories: [],
      messages: [],
      entries: store.db.journey_entries.map((row) => ({
        ...row.entry,
        revision: row.revision,
      })),
    };
    localStorage.setItem(
      `iwillbe.practice.v2.${owner}`,
      JSON.stringify(initial),
    );
  }
  const db = store.db;
  const persist = () => localStorage.setItem(stateKey, JSON.stringify(store));
  sessionStorage.setItem("round3.qa.scenario", scenario);
  sessionStorage.setItem("round3.qa.reset", resetToken);
  if (store.signedIn) localStorage.setItem(authKey, JSON.stringify(session));
  else localStorage.removeItem(authKey);
  persist();
  let handled = 0,
    blocked = 0;
  const requests = [];
  function status() {
    if (parent !== window)
      parent.postMessage(
        { type: "round3-qa-status", scenario, handled, blocked, clock },
        location.origin,
      );
  }
  const isSupabase = (url) =>
    url.hostname === configuredHost ||
    /(^|\.)supabase\.(co|in)$/.test(url.hostname);
  const allowedAsset = (url) =>
    url.origin === location.origin ||
    /(^|\.)(vercel\.live|vercel-insights\.com)$/.test(url.hostname);
  const reply = (value, code = 200, extra = {}) =>
    new Response(JSON.stringify(value), {
      status: code,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...extra,
      },
    });
  const error = (message, code = "QA_UNHANDLED", statusCode = 400) =>
    reply({ code, message, error: message }, statusCode);
  const sharedTables = {
    priority_words: catalogue.priorities,
    quick_pick_cards: catalogue.quickPicks,
    interest_links: catalogue.interestLinks,
    learning_shelf: catalogue.learningShelf,
  };
  const list = (name) =>
    name === "missions"
      ? [
          ...catalogue.missions.map((row) => ({
            ...row,
            user_id: null,
            active: true,
          })),
          ...db.missions,
        ]
      : name === "early_access_report_admins"
        ? scenario === "admin-allowed"
          ? [{ user_id: owner, created_at: now() }]
          : []
        : sharedTables[name] || db[name];
  function matches(row, filters) {
    for (const [key, value] of filters) {
      if (["select", "order", "limit", "offset", "on_conflict"].includes(key))
        continue;
      const actual = row[key];
      if (value.startsWith("eq.") && String(actual) !== value.slice(3))
        return false;
      if (value.startsWith("neq.") && String(actual) === value.slice(4))
        return false;
      if (value === "is.null" && actual != null) return false;
      if (value === "not.is.null" && actual == null) return false;
      if (
        value.startsWith("in.(") &&
        !value
          .slice(4, -1)
          .split(",")
          .map((item) => item.replace(/^"|"$/g, ""))
          .includes(String(actual))
      )
        return false;
      for (const operator of ["gte", "gt", "lte", "lt"])
        if (value.startsWith(operator + ".")) {
          const boundary = value.slice(operator.length + 1);
          if (
            (operator === "gte" && !(actual >= boundary)) ||
            (operator === "gt" && !(actual > boundary)) ||
            (operator === "lte" && !(actual <= boundary)) ||
            (operator === "lt" && !(actual < boundary))
          )
            return false;
        }
    }
    return true;
  }
  function sampleReport(week) {
    const end = new Date(`${week}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const base = {
      timezone: "America/New_York",
      onboarding_complete: true,
      onboarding_step: "Completed",
      onboarding_cursor: null,
      focus_days: 4,
      mornings_with_focus: 3,
      typed_focuses: 2,
      suggested_focuses: 2,
      night_checkins: 3,
      night_checkins_coverage: "collected",
      sunday_review_opened: 1,
      my_map_opened: 2,
      future_me_opened: 1,
      screen_metrics_status: "collected",
      screen_metrics_since: "2026-11-01T12:00:00Z",
      last_active_day: week,
    };
    return {
      week_start: week,
      week_end_exclusive: end.toISOString().slice(0, 10),
      generated_at: now(),
      instrumentation_started_at: "2026-11-01T12:00:00Z",
      participants: [
        {
          ...base,
          user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          display_name: "Jordan Example",
          email: "jordan@example.test",
        },
        {
          ...base,
          user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          display_name: "Morgan Example",
          email: "morgan@example.test",
          onboarding_complete: false,
          onboarding_step: "Quick picks",
          onboarding_cursor: 4,
          focus_days: 0,
          mornings_with_focus: 0,
          typed_focuses: 0,
          suggested_focuses: 0,
          night_checkins: null,
          night_checkins_coverage: "observed",
          sunday_review_opened: null,
          my_map_opened: null,
          future_me_opened: null,
          screen_metrics_status: "not_collected",
          screen_metrics_since: null,
        },
      ],
    };
  }
  function generatedMissions(input) {
    const tag = String(input.interest || "something that matters").slice(0, 80);
    const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const priority = input.priority || "curious";
    const template =
      catalogue.missions.find(
        (row) => row.setting === "Home" && row.level === "easy",
      ) || catalogue.missions[0];
    const rows = ["easy", "normal", "stretch"].map((level, index) => ({
      ...template,
      id: `QA-${slug}-1${"abc"[index]}`,
      user_id: owner,
      family_id: `QA-${slug}-1`,
      ladder: `QA-${slug}`,
      ladder_step: 1,
      level,
      size: ["5-minute", "Normal", "Stretch"][index],
      minutes: [5, 20, 45][index],
      type: "do",
      active: true,
      priorities: [priority],
      interests: input.kind === "place" ? [] : [tag],
      places: input.kind === "place" ? [input.where] : [],
      tags: [priority, tag],
      ages: [],
      setting: "Home",
      theme: "",
      mission_text: [
        `Take five minutes at home to choose one small way to explore ${tag}.`,
        `Spend twenty minutes at home trying your first small ${tag} idea.`,
        `Set aside forty-five minutes at home to build on the same ${tag} idea.`,
      ][index],
      first_step: "Choose one thing you already have at home and start there.",
      safety_note: "",
      provenance: "Isolated QA fixture",
    }));
    db.missions = db.missions
      .filter((row) => !rows.some((item) => item.id === row.id))
      .concat(rows);
    persist();
    return rows;
  }
  async function handle(url, method, headers, input) {
    const path = url.pathname,
      name = path.split("/").at(-1);
    if (path.startsWith("/auth/")) {
      if (name === "logout") {
        store.signedIn = false;
        localStorage.removeItem(authKey);
        persist();
        return reply({});
      }
      if (name === "user")
        return store.signedIn
          ? reply(user)
          : error("No fixture session", "401", 401);
      if (["recover", "resend", "otp"].includes(name)) return reply({});
      store.signedIn = true;
      localStorage.setItem(authKey, JSON.stringify(session));
      persist();
      return reply(session);
    }
    if (!store.signedIn)
      return error("Sign in to the fictional account.", "401", 401);
    if (path.includes("/functions/")) {
      if (name !== "chloe")
        return reply({ invitations: [], suggestions: [], fixture: true });
      const action = input.action;
      if (action === "start_checkin")
        return reply({ started: true, support_level: 0 });
      if (action === "night_thought") {
        if (scenario === "offline-night")
          return error("QA simulated night-thought outage", "QA_OFFLINE", 503);
        return reply({
          thought: {
            id: -920001,
            format: "reframe",
            text: "The small kindness you made room for today is part of the life you’re building.",
            person: "",
            source: "",
            credit: "",
            priorities: ["kind"],
            traditions: [],
            once_only: false,
            status: "verified",
          },
          support_level: 0,
        });
      }
      if (action === "round2_onboarding")
        return reply({
          priorities: ["kind", "patient"],
          interests: input.kind === "kid" ? ["drawing"] : ["baking"],
        });
      if (action === "round2_tag_focus") return reply({ tagged: true });
      if (action === "round2_moment") return reply({ moment: null });
      if (action === "round2_review")
        return reply({
          intro: "You made room for people and interests that matter to you.",
          pattern:
            "Time with your kids keeps coming up. Does that feel like something to keep choosing?",
          reflection: "What was the best part of your week?",
          moment: null,
        });
      if (action === "round2_summarize") {
        const day = "2026-11-19";
        const row = {
          user_id: owner,
          day,
          session_id: `night:${day}`,
          summary: "You made room for something that matters to you.",
          hard_day: false,
          opener_line: null,
          created_at: now(),
        };
        db.checkin_summaries = db.checkin_summaries
          .filter((item) => item.day !== day)
          .concat(row);
        persist();
        return reply(row);
      }
      if (action === "missions")
        return reply({ missions: generatedMissions(input) });
      if (action === "chat") {
        const messages = [
          {
            id: uuid(),
            user_id: owner,
            role: "user",
            content: String(input.message || ""),
            created_at: now(),
          },
          {
            id: uuid(),
            user_id: owner,
            role: "assistant",
            content:
              "What’s one small thing you’d like to make room for today?",
            created_at: now(),
          },
        ];
        db.messages.push(...messages);
        persist();
        return reply({ messages, support_level: 0 });
      }
      if (action === "delete_account") {
        store.signedIn = false;
        persist();
        return reply({ deleted: true });
      }
      return error(
        `No live AI call: unsupported fixture action ${String(action)}`,
        "QA_UNHANDLED_ACTION",
        501,
      );
    }
    if (path.includes("/rpc/")) {
      if (name === "get_early_access_report")
        return scenario === "admin-allowed"
          ? reply(sampleReport(input.p_week_start))
          : error(
              "This report is available only to its administrator.",
              "42501",
              403,
            );
      if (name === "replace_daily_focus") {
        const row = db.intentions.find(
          (item) => item.id === input.p_id && item.user_id === owner,
        );
        if (!row || row.revision !== input.p_revision)
          return error("This focus changed on another device.", "40001", 409);
        if (!String(input.p_focus?.action || "").trim())
          return error("Choose a focus first.", "23514", 400);
        db.check_ins = db.check_ins.filter(
          (item) => item.intention_id !== row.id,
        );
        Object.assign(row, input.p_focus, {
          id: row.id,
          user_id: owner,
          revision: row.revision + 1,
        });
        persist();
        return reply(row);
      }
      if (name === "record_quick_pick") {
        const previous = db.quick_pick_responses.find(
          (item) => item.quick_pick_id === input.p_card,
        );
        const row = {
          user_id: owner,
          quick_pick_id: input.p_card,
          session_id: input.p_session,
          choice: input.p_choice,
          not_now_count: input.p_choice === "pass" ? 1 : 0,
          last_shown_at: now(),
        };
        if (previous) Object.assign(previous, row);
        else db.quick_pick_responses.push(row);
        persist();
        return reply(null);
      }
      if (name === "mission_options")
        return reply(
          list("missions").filter(
            (row) =>
              row.ladder_step === input.p_step &&
              [row.tags, row.priorities, row.interests, row.places].some(
                (tags) => tags?.includes(input.p_tag),
              ),
          ),
        );
      if (name === "import_local_practice")
        return reply({ imported: 0, skipped_days: [] });
      return error(
        `No live database call: unsupported fixture RPC ${name}`,
        "QA_UNHANDLED_RPC",
        501,
      );
    }
    if (!path.startsWith("/rest/"))
      return error(
        "No live service is available in this fixture.",
        "QA_UNHANDLED",
        501,
      );
    const all = list(name);
    if (!all)
      return error(
        `Unsupported fixture table ${name}`,
        "QA_UNHANDLED_TABLE",
        501,
      );
    const immutable =
      Object.hasOwn(sharedTables, name) ||
      name === "early_access_report_admins";
    const visible = all.filter((row) => !row.user_id || row.user_id === owner);
    let result = visible.filter((row) => matches(row, url.searchParams));
    if (["POST", "PATCH", "DELETE"].includes(method) && immutable)
      return error("This fixture table is read-only.", "42501", 403);
    if (method === "POST") {
      result = [];
      for (const supplied of Array.isArray(input) ? input : [input]) {
        if (supplied.user_id && supplied.user_id !== owner)
          return error("Choose your own data.", "42501", 403);
        const keys = (
          url.searchParams.get("on_conflict") ||
          (name === "profiles"
            ? "id"
            : name === "check_ins"
              ? "intention_id"
              : name === "intentions"
                ? "user_id,day"
                : "id")
        ).split(",");
        const values = {
          ...supplied,
          ...(name === "profiles" ? { id: owner } : { user_id: owner }),
        };
        const previous = db[name].find((row) =>
          keys.every(
            (key) =>
              values[key] !== undefined &&
              String(row[key]) === String(values[key]),
          ),
        );
        const merge = headers
          .get("Prefer")
          ?.includes("resolution=merge-duplicates");
        if (previous && !merge)
          return error("That saved item already exists.", "23505", 409);
        if (previous) {
          Object.assign(previous, values, {
            revision: (previous.revision || 1) + 1,
            updated_at: now(),
          });
          result.push(previous);
        } else {
          const row = {
            id: values.id || uuid(),
            created_at: now(),
            ...values,
            revision: 1,
          };
          db[name].push(row);
          result.push(row);
        }
      }
      persist();
    } else if (method === "PATCH") {
      for (const row of result)
        Object.assign(row, input, {
          revision: (row.revision || 1) + 1,
          updated_at: now(),
        });
      persist();
    } else if (method === "DELETE") {
      db[name] = db[name].filter((row) => !result.includes(row));
      persist();
    } else if (!["GET", "HEAD"].includes(method))
      return error("Unsupported local method.", "QA_UNHANDLED_METHOD", 405);
    const order = url.searchParams.get("order");
    if (order)
      result = [...result].sort((a, b) => {
        for (const part of order.split(",")) {
          const [key, direction] = part.split(".");
          const compared = String(a[key] ?? "").localeCompare(
            String(b[key] ?? ""),
          );
          if (compared) return direction === "desc" ? -compared : compared;
        }
        return 0;
      });
    const total = result.length;
    const offset = Number(url.searchParams.get("offset") || 0);
    const limit = Number(url.searchParams.get("limit") || total || 1);
    result = result.slice(offset, offset + limit);
    const single = headers.get("Accept")?.includes("vnd.pgrst.object");
    return reply(
      single ? result[0] || null : result,
      method === "POST" ? 201 : 200,
      {
        "Content-Range": `${offset}-${Math.max(offset, offset + result.length - 1)}/${total}`,
      },
    );
  }
  window.fetch = async (input, init = {}) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL
        ? String(input)
        : input.url,
      location.href,
    );
    if (!isSupabase(url)) {
      if (allowedAsset(url)) return realFetch(input, init);
      blocked++;
      status();
      throw new TypeError("External network is disabled in this QA preview.");
    }
    handled++;
    const method = String(init.method || input?.method || "GET").toUpperCase();
    const headers = new Headers(
      typeof input === "object" && input.headers ? input.headers : undefined,
    );
    new Headers(init.headers || {}).forEach((value, key) =>
      headers.set(key, value),
    );
    let body = init.body;
    if (
      body === undefined &&
      typeof input === "object" &&
      typeof input.clone === "function"
    )
      body = await input.clone().text();
    let parsed = {};
    if (typeof body === "string" && body) {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = Object.fromEntries(new URLSearchParams(body));
      }
    }
    requests.push({ method, path: url.pathname });
    if (requests.length > 100) requests.shift();
    status();
    try {
      return await handle(url, method, headers, parsed);
    } catch (cause) {
      console.error("Local QA fixture error:", cause);
      return error(
        "The local fixture could not handle this request.",
        "QA_FIXTURE_ERROR",
        500,
      );
    }
  };
  // Defense in depth: other browser network transports cannot bypass fetch.
  if (window.XMLHttpRequest) {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, target, ...args) {
      const url = new URL(String(target), location.href);
      if (isSupabase(url) || !allowedAsset(url)) {
        blocked++;
        status();
        throw new Error("External XHR is disabled in the QA fixture.");
      }
      return originalOpen.call(this, method, target, ...args);
    };
  }
  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (target, value) => {
      const url = new URL(String(target), location.href);
      if (isSupabase(url) || !allowedAsset(url)) {
        blocked++;
        status();
        return false;
      }
      return originalBeacon(target, value);
    };
  }
  for (const key of ["WebSocket", "EventSource"]) {
    const Original = window[key];
    if (!Original) continue;
    function Guarded(target, ...args) {
      const url = new URL(String(target), location.href);
      if (isSupabase(url) || !allowedAsset(url)) {
        blocked++;
        status();
        throw new Error("External connections are disabled in the QA fixture.");
      }
      return new Original(target, ...args);
    }
    Object.setPrototypeOf(Guarded, Original);
    Guarded.prototype = Original.prototype;
    window[key] = Guarded;
  }
  document.addEventListener(
    "click",
    (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor) return;
      const url = new URL(anchor.href, location.href);
      if (!["blob:", "data:"].includes(url.protocol) && !allowedAsset(url)) {
        event.preventDefault();
        blocked++;
        status();
      }
    },
    true,
  );
  window.__ROUND3_QA__ = {
    scenario,
    clock,
    requests,
    inspect: () => JSON.parse(JSON.stringify(db)),
    counters: () => ({ handled, blocked }),
  };
  window.addEventListener("load", status);
  status();
})();
