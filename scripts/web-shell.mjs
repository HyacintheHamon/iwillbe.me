import { readFile, writeFile } from "node:fs/promises";
const file = new URL("../dist/index.html", import.meta.url);
let html = await readFile(file, "utf8");
html = html.replace(
  "</head>",
  '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#F7F6F2"><meta name="description" content="Find your possibilities. Live your why, one small commitment at a time. Make room for a life that feels like yours."><style>:focus-visible{outline:2px solid #48634F!important;outline-offset:4px}html,body{background:#EEEFE9}::selection{background:#48634F;color:#fff}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style></head>',
);
await writeFile(file, html);
