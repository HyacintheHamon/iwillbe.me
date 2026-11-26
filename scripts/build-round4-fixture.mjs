// Optional offline QA export. Production `npm run build` never runs this file.
// A copy of dist is written to test-results/round4-preview; dist stays untouched.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.VERCEL_ENV === "production")
  throw new Error(
    "The isolated QA fixture must never be built for production.",
  );
const root = fileURLToPath(new URL("../", import.meta.url));
const target = path.join(root, "test-results/round4-preview");
let html = await readFile(path.join(root, "dist/index.html"), "utf8");
if (!html.includes("<head>")) throw new Error("Run npm run build first.");
await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(path.join(root, "dist"), target, { recursive: true });
const load = async (name) =>
  JSON.parse(
    await readFile(path.join(root, `data/round4/${name}.json`), "utf8"),
  );
const missions = await load("missions");
const interestLinks = await load("interest-links");
const learningShelf = await load("learning-shelf");
const priorities = [...new Set(missions.flatMap((row) => row.priorities))].map(
  (name, position) => ({ name, position }),
);
const quickPicks = [...new Set(interestLinks.map((row) => row.interest))].map(
  (title, position) => ({
    id: title.replaceAll(" ", "-"),
    title,
    position,
    description:
      interestLinks.find((row) => row.interest === title)?.reason ||
      "A small first step.",
  }),
);
const data = {
  missions,
  interestLinks,
  learningShelf,
  priorities,
  quickPicks,
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    "https://mvhqovdznrzoduntyryh.supabase.co",
};
await writeFile(
  path.join(target, "qa-fixture-data.js"),
  `window.__ROUND4_QA_DATA__ = ${JSON.stringify(data)};\n`,
);
await cp(
  new URL("fixtures/round4-seed.js", import.meta.url),
  path.join(target, "qa-fixture-seed.js"),
);

// Reuse the existing owner/revision-aware local transport. Assert each hook so
// future fixture changes fail loudly instead of accidentally enabling a service.
let runtime = (
  await readFile(new URL("fixtures/round3-runtime.js", import.meta.url), "utf8")
)
  .replaceAll("ROUND3", "ROUND4")
  .replaceAll("round3", "round4");
function replaceOnce(before, after) {
  if (runtime.split(before).length !== 2)
    throw new Error(`Missing unique QA hook: ${before.slice(0, 80)}`);
  runtime = runtime.replace(before, after);
}
replaceOnce(
  '    "admin-allowed",',
  '    "admin-allowed",\n    "next-day",\n    "previous-obstacle",',
);
replaceOnce(
  '  const clock = ["evening", "offline-night"].includes(scenario)\n    ? "2026-11-19T23:00:00Z"\n    : "2026-11-19T14:00:00Z";',
  '  let clock = query.get("qaClock") || sessionStorage.getItem("round4.qa.clock") || (["evening", "offline-night", "previous-obstacle"].includes(scenario)\n    ? "2026-11-26T23:00:00Z"\n    : scenario === "next-day" ? "2026-11-27T14:00:00Z" : "2026-11-26T14:00:00Z");',
);
replaceOnce(
  "  const clockMs = RealDate.parse(clock);",
  "  let clockMs = RealDate.parse(clock);",
);
replaceOnce(
  "    return { scenario, resetToken, signedIn: true, db };",
  "    window.__ROUND4_QA_SEED__({ db, entry, now, uuid, owner, scenario });\n    return { scenario, resetToken, signedIn: true, db };",
);
replaceOnce(
  "      profile: store.db.profiles[0],\n      intentions: [],\n      checkIns: [],",
  "      profile: store.db.profiles[0],\n      intentions: store.db.intentions,\n      checkIns: store.db.check_ins,",
);
replaceOnce(
  '        const day = "2026-11-19";',
  '        const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());',
);
replaceOnce(
  '  sessionStorage.setItem("round4.qa.reset", resetToken);',
  '  sessionStorage.setItem("round4.qa.reset", resetToken);\n  sessionStorage.setItem("round4.qa.clock", clock);',
);
replaceOnce(
  "    scenario,\n    clock,\n    requests,",
  "    scenario,\n    get clock() { return clock; },\n    requests,",
);
replaceOnce(
  "  const allowedAsset = (url) =>\n    url.origin === location.origin ||\n    /(^|\\.)(vercel\\.live|vercel-insights\\.com)$/.test(url.hostname);",
  "  const allowedAsset = (url) => url.origin === location.origin;",
);
replaceOnce(
  "    counters: () => ({ handled, blocked }),",
  '    counters: () => ({ handled, blocked }),\n    advanceTo: (iso) => {\n      const timestamp = RealDate.parse(iso);\n      if (!Number.isFinite(timestamp)) throw new Error("Invalid fixture date");\n      clock = iso; clockMs = timestamp;\n      sessionStorage.setItem("round4.qa.clock", iso);\n      persist();\n    },',
);
await writeFile(path.join(target, "qa-fixture-runtime.js"), runtime);
const csp =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
const injection = `<meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="${csp}"><script src="/qa-fixture-data.js"></script><script src="/qa-fixture-seed.js"></script><script src="/qa-fixture-runtime.js"></script>`;
html = html.replace(
  /<!-- ROUND3_ISOLATED_QA_START -->[\s\S]*?<!-- ROUND3_ISOLATED_QA_END -->/,
  "",
);
html = html.replace("<head>", `<head>${injection}`);
html = html.replace(
  /<title>.*?<\/title>/,
  "<title>iwillbe.me · Round 4 offline QA</title>",
);
await writeFile(path.join(target, "index.html"), html);
await cp(
  new URL("fixtures/round4-controller.html", import.meta.url),
  path.join(target, "qa.html"),
);
await writeFile(
  path.join(target, "qa-fixture.json"),
  JSON.stringify(
    {
      isolated: true,
      production_allowed: false,
      data: "fictional",
      scenarios: ["morning", "evening", "next-day", "previous-obstacle"],
      controller: "/qa.html",
      viewports: ["390x844", "320x568"],
      missions: missions.length,
    },
    null,
    2,
  ),
);
console.log(`Offline Round 4 preview ready in ${target}.`);
console.log(
  "Run node scripts/serve-round4-fixture.mjs, then UI_BASE_URL=http://localhost:4184 node scripts/verify-round4.mjs.",
);
