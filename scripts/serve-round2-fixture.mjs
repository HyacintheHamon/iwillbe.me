// Local-only UI fixture. Fake auth and all data stay in memory; no account or AI calls.
// Run after `npm run build`: node --import tsx scripts/serve-round2-fixture.mjs
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { emptyPractice } from "../src/domain.ts";
import { PRIORITY_WORDS, QUICK_PICKS } from "../src/priorities.ts";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = {
  id: owner,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const expiry = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", exp: expiry })).toString("base64url")}.fixture`;
const session = {
  user,
  access_token: jwt,
  refresh_token: "fixture",
  token_type: "bearer",
  expires_at: expiry,
  expires_in: 86400,
};
const now = new Date().toISOString();
let db;
function reset(fresh = false) {
  const p = emptyPractice();
  db = {
    profiles: [
      {
        ...p.profile,
        id: owner,
        onboarded: !fresh,
        joined_at: now,
        revision: 1,
      },
    ],
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
    priority_words: PRIORITY_WORDS,
    quick_pick_cards: QUICK_PICKS,
  };
  if (!fresh) {
    for (const [kind, title, state] of [
      ["value", "kind", "working_on"],
      ["value", "curious", "working_on"],
      ["value", "healthy", "working_on"],
      ["interest", "reading", "into_it"],
      ["interest", "hiking", "from_time_to_time"],
      ["interest", "gardening", "want_to_try"],
    ]) {
      const id = randomUUID();
      db.journey_entries.push({
        id,
        user_id: owner,
        kind,
        revision: 1,
        entry: {
          id,
          kind,
          title,
          state,
          body: "",
          meta: {},
          source: "Fixture",
          source_ids: [],
          created_at: now,
          updated_at: now,
        },
      });
    }
    db.places.push({
      id: randomUUID(),
      user_id: owner,
      label: "with friends",
      sort_order: 0,
    });
  }
}
reset();
const root = path.resolve("dist");
const port = Number(process.argv[process.argv.indexOf("--port") + 1] || 4181);
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};
const init = `<script>localStorage.setItem('sb-mvhqovdznrzoduntyryh-auth-token',${JSON.stringify(JSON.stringify(session))});const originalFetch=window.fetch;window.fetch=(input,options)=>{const u=typeof input==='string'?input:input.url;if(u.startsWith('https://mvhqovdznrzoduntyryh.supabase.co/'))return originalFetch('/mock'+new URL(u).pathname+new URL(u).search,options);return originalFetch(input,options);};</script>`;
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const send = (x, status = 200) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(x));
    };
    if (url.pathname === "/qa" || url.pathname === "/qa-new") {
      reset(url.pathname === "/qa-new");
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<html><body style="margin:0;background:#ddd;display:flex;justify-content:center"><iframe title="Round 2 local test" src="/?reset=1" style="width:390px;height:844px;border:0"></iframe></body></html>`,
      );
      return;
    }
    if (url.pathname.startsWith("/mock")) {
      let body = "";
      for await (const chunk of req) body += chunk;
      const input = body ? JSON.parse(body) : {};
      const name = url.pathname.split("/").at(-1);
      if (url.pathname.includes("/auth/"))
        return send(name === "user" ? user : name === "logout" ? {} : session);
      if (url.pathname.includes("/functions/")) {
        const action = input.action;
        if (action === "round2_onboarding")
          return send({
            priorities: ["kind", "patient"],
            interests: input.kind === "kid" ? ["drawing"] : ["baking"],
          });
        if (action === "round2_tag_focus") return send({ tagged: true });
        if (action === "round2_moment") return send({ moment: null });
        if (action === "round2_review")
          return send({
            intro: "",
            pattern: "",
            reflection: "What was the best part of your week?",
            moment: null,
          });
        if (action === "round2_summarize")
          return send({
            summary: "You made room for something that matters to you.",
            hard_day: false,
            opener_line: null,
          });
        return send({ thought: null, started: true });
      }
      if (url.pathname.includes("/rpc/")) {
        if (name === "replace_daily_focus") {
          const row = db.intentions.find((i) => i.id === input.p_id);
          db.check_ins = db.check_ins.filter((c) => c.intention_id !== row.id);
          Object.assign(row, input.p_focus, { revision: row.revision + 1 });
          return send(row);
        }
        return send(null);
      }
      const rows = db[name];
      if (!rows) throw new Error("Unhandled table " + name);
      const matches = (row) =>
        [...url.searchParams].every(
          ([k, v]) =>
            ["select", "order", "limit", "offset", "on_conflict"].includes(k) ||
            !v.startsWith("eq.") ||
            String(row[k]) === v.slice(3),
        );
      const single = req.headers.accept?.includes("vnd.pgrst.object");
      let result = rows.filter(matches);
      if (req.method === "POST") {
        const row = {
          ...input,
          id: input.id || randomUUID(),
          user_id: owner,
          revision: 1,
          created_at: now,
        };
        rows.push(row);
        result = [row];
      }
      if (req.method === "PATCH")
        result.forEach((row) =>
          Object.assign(row, input, { revision: (row.revision || 1) + 1 }),
        );
      if (req.method === "DELETE") db[name] = rows.filter((r) => !matches(r));
      return send(single ? result[0] || null : result);
    }
    let file = path.resolve(root, "." + url.pathname);
    if (!file.startsWith(root + path.sep) && file !== root)
      return send({}, 403);
    try {
      if (!(await stat(file)).isFile()) file = path.join(root, "index.html");
    } catch {
      file = path.join(root, "index.html");
    }
    let content = await readFile(file);
    if (file.endsWith(".html"))
      content = Buffer.from(
        content
          .toString()
          .replace(
            "<head>",
            `<head>${url.searchParams.has("reset") ? "<script>localStorage.clear();sessionStorage.clear();</script>" : ""}${init}`,
          ),
      );
    res.writeHead(200, {
      "content-type": types[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(content);
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end("Fixture error");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Round 2 isolated fixture: http://127.0.0.1:${port}/qa`),
);
