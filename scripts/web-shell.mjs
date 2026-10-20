import { readFile, writeFile } from "node:fs/promises";
const file = new URL("../dist/index.html", import.meta.url);
let html = await readFile(file, "utf8");
html = html.replace(
  "</head>",
  '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#0D0E20"><meta name="description" content="Discover your sparks. Try one small thing. Make room for a life that feels like yours."><style>:focus-visible{outline:2px solid #F4C96D!important;outline-offset:4px}html,body{background:#080912}::selection{background:#675635;color:#fff}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}</style></head>',
);
await writeFile(file, html);
