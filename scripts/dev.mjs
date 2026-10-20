import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const i = args.indexOf("--port");
const port = i >= 0 ? args[i + 1] : "4173";
const child = spawn(
  process.execPath,
  [
    "node_modules/expo/bin/cli",
    "start",
    "--web",
    "--port",
    port,
    "--host",
    "lan",
  ],
  { stdio: "inherit", env: { ...process.env, CI: "1" } },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
