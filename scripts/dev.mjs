// Normalize preview-runner flags; also supports plain npm run dev on Windows.
import { spawn } from "node:child_process";
const args = process.argv.slice(2),
  next = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--strictPort") continue;
  if (args[i] === "--host") {
    next.push("--hostname", args[++i]);
    continue;
  }
  next.push(args[i]);
}
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...next],
  { stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
