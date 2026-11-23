import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const candidates = process.env.PYTHON
  ? [[process.env.PYTHON]]
  : process.platform === "win32"
    ? [["py", "-3"], ["python"]]
    : [["python3"], ["python"]];
const interpreter = candidates.find(
  ([bin, ...args]) =>
    spawnSync(bin, [
      ...args,
      "-c",
      "import sys;sys.exit(sys.version_info < (3,11))",
    ]).status === 0,
);
if (!interpreter)
  throw Error("Instale Python 3.11 ou superior e reabra o terminal.");
const [bin, ...args] = interpreter;
const worker = spawn(
  bin,
  [...args, "-B", fileURLToPath(new URL("engine.py", import.meta.url))],
  { stdio: ["pipe", "pipe", "inherit"] },
);

// JSON-lines is ordered: responses must never be assigned to a different
// caller when a request times out or the Python process terminates.
const queue = [];
const configuredTimeout = Number(process.env.POKER_ENGINE_TIMEOUT_MS ?? 90000);
const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
  ? configuredTimeout
  : 90000;
let stopped = false;
let headTimer;

function clearHeadTimer() {
  if (headTimer) clearTimeout(headTimer);
  headTimer = undefined;
}
function failAll(error) {
  if (stopped) return;
  stopped = true;
  clearHeadTimer();
  for (const job of queue.splice(0)) job.reject(error);
  if (!worker.killed) worker.kill();
}
function watchHead() {
  clearHeadTimer();
  if (stopped || !queue.length) return;
  headTimer = setTimeout(() => {
    failAll(new Error(`Motor de pôquer sem resposta por ${timeoutMs} ms. Reinicie o servidor.`));
  }, timeoutMs);
  headTimer.unref?.();
}

createInterface({ input: worker.stdout }).on("line", (line) => {
  if (stopped) return;
  const job = queue.shift();
  if (!job) {
    failAll(new Error("Resposta inesperada do motor de pôquer."));
    return;
  }
  clearHeadTimer();
  try {
    const result = JSON.parse(line);
    if (result.error) throw Error(String(result.error));
    job.resolve(result);
  } catch (error) {
    // A malformed reply cannot be trusted: subsequent requests might lose
    // synchronization. Valid engine errors remain scoped to their request.
    if (error instanceof SyntaxError) {
      job.reject(error);
      failAll(new Error("Resposta inválida do motor de pôquer."));
      return;
    }
    job.reject(error);
  }
  watchHead();
});
worker.on("error", (error) => failAll(error));
worker.on("exit", (code, signal) =>
  failAll(new Error(`Motor encerrado (${signal ?? code ?? "desconhecido"}).`)),
);
worker.stdin.on("error", (error) => failAll(error));

export function step(query) {
  return new Promise((resolve, reject) => {
    if (stopped) return reject(Error("Motor indisponível"));
    const wasEmpty = queue.length === 0;
    queue.push({ resolve, reject });
    if (wasEmpty) watchHead();
    try {
      worker.stdin.write(JSON.stringify(query) + "\n", (error) => {
        if (error) failAll(error);
      });
    } catch (error) {
      failAll(error);
    }
  });
}
export function stop() {
  failAll(new Error("Motor encerrado a pedido."));
}
