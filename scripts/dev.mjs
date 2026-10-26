import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--watch", "stackflow-backend/src/server.js"], {
    stdio: "inherit",
  }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    cwd: "stackflow-frontend",
    stdio: "inherit",
  }),
];
function stop() {
  for (const child of children) child.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("error", stop);
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  });
}
