import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const url = "http://127.0.0.1:" + (process.env.PORT || 4190);
const child = spawn(process.execPath, ["server/local.mjs"], {
  stdio: ["inherit", "pipe", "inherit"],
  env: process.env,
});
let opened = false;
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (!opened && chunk.toString().includes("Mesa Real em")) {
    opened = true;
    console.log(
      "Mantenha esta janela aberta durante a partida. Para encerrar, pressione Ctrl+C.",
    );
    spawn("explorer.exe", [url], { stdio: "ignore", detached: true }).unref();
  }
});
process.on("SIGINT", () => child.kill());
child.on("exit", (code) => (process.exitCode = code || 0));
