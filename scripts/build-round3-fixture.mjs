// Optional, isolated QA export. The normal `npm run build` never runs this file.
// Run only for a separate preview: npm run build && node scripts/build-round3-fixture.mjs
import { readFile, writeFile, copyFile } from "node:fs/promises";

if (process.env.VERCEL_ENV === "production")
  throw new Error(
    "The isolated QA fixture must never be built for production.",
  );
const dist = new URL("../dist/", import.meta.url);
const htmlPath = new URL("index.html", dist);
let html = await readFile(htmlPath, "utf8");
if (!html.includes("<head>"))
  throw new Error("Build the web app before injecting the QA fixture.");
const loadJson = async (name) =>
  JSON.parse(
    await readFile(new URL(`../data/round3/${name}`, import.meta.url), "utf8"),
  );
const missions = await loadJson("missions.json");
const interestLinks = await loadJson("interest-links.json");
const learningShelf = await loadJson("learning-shelf.json");
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://mvhqovdznrzoduntyryh.supabase.co";
const priorities = [...new Set(missions.flatMap((row) => row.priorities))].map(
  (name, position) => ({ name, position }),
);
const quickPickNames = [
  "cooking for friends",
  "reading",
  "exploring new places",
  "gardening",
  "working out",
  "hiking",
  "playing sports",
  "making music",
  "taking photos",
  "building things",
  "hosting game night",
  "volunteering",
  "mentoring someone",
  "learning a language",
  "meditating",
];
const quickPicks = quickPickNames.map((title, position) => ({
  id: title.replaceAll(" ", "-"),
  title,
  position,
  description:
    interestLinks.find((link) => link.interest === title)?.reason ||
    "Try a small step and see how it feels.",
}));
await writeFile(
  new URL("qa-fixture-data.js", dist),
  `window.__ROUND3_QA_DATA__ = ${JSON.stringify({ supabaseUrl, missions, interestLinks, learningShelf, priorities, quickPicks })};\n`,
);
await copyFile(
  new URL("fixtures/round3-runtime.js", import.meta.url),
  new URL("qa-fixture-runtime.js", dist),
);
await copyFile(
  new URL("fixtures/round3-controller.html", import.meta.url),
  new URL("qa.html", dist),
);
const csp =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel.live; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https://*.vercel.live; connect-src 'self' https://*.vercel.live https://*.vercel-insights.com; frame-src 'self' https://*.vercel.live; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
const injection = `<!-- ROUND3_ISOLATED_QA_START --><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="${csp}"><script src="/qa-fixture-data.js"></script><script src="/qa-fixture-runtime.js"></script><!-- ROUND3_ISOLATED_QA_END -->`;
html = html.replace(
  /<!-- ROUND3_ISOLATED_QA_START -->[\s\S]*?<!-- ROUND3_ISOLATED_QA_END -->/,
  "",
);
html = html.replace("<head>", `<head>${injection}`);
html = html.replace(
  /<title>.*?<\/title>/,
  "<title>iwillbe.me · isolated QA</title>",
);
await writeFile(htmlPath, html);
await writeFile(
  new URL("qa-fixture.json", dist),
  JSON.stringify(
    {
      isolated: true,
      production_allowed: false,
      data: "fictional",
      entry: "/qa.html",
      scenarios: [
        "morning",
        "evening",
        "new",
        "offline-night",
        "admin-denied",
        "admin-allowed",
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Isolated Round 3 QA export ready at /qa.html. No Supabase service is used.",
);
