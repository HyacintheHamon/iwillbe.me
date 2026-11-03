import { readFile, writeFile } from "node:fs/promises";
const file = new URL("../dist/index.html", import.meta.url);
let html = await readFile(file, "utf8");
html = html.replace(/<title>.*?<\/title>/, "<title>iwillbe.me</title>");
html = html.replace(
  "</head>",
  '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#F7F6F2"><meta name="description" content="Find your why. Choose one concrete action. Live it today."><style>:focus-visible{outline:2px solid #C2410C!important;outline-offset:4px}html,body{background:#EEEFE9}::selection{background:#C2410C;color:#fff}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style></head>',
);
await writeFile(file, html);
