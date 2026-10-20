import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist"),
  port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
};
createServer(async (req, res) => {
  try {
    let target = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (!target.startsWith(root + path.sep) && target !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(target)).isFile())
        target = path.join(root, "index.html");
    } catch {
      target = path.join(root, "index.html");
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(500);
    res.end("Preview unavailable");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Expo web export: http://localhost:${port}`),
);
