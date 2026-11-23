import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  showdownFlow,
  SHOWDOWN_RESULTS_GAP_MS,
  SHOWDOWN_WINNER_HOLD_MS,
  SHOWDOWN_AWARD_GAP_MS,
} from "../src/showdown-flow.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

for (const runs of [2, 3]) {
  test(`Run It ${runs}: all cards, then five-card winner, then chip award`, () => {
    for (const from of [0, 3, 4]) {
      const f = { finished: true, runoutFrom: from, runoutDelay: 650, runoutStep: 530,
        board: ["As", "Kd", "Qh", "Jc", "Ts"],
        boards: Array.from({ length: runs }, () => ["As", "Kd", "Qh", "Jc", "Ts"]),
      };
      const end = f.runoutDelay + (runs * (5-from) - 1)*f.runoutStep;
      const winnerAt = end + SHOWDOWN_RESULTS_GAP_MS;
      const awardAt = winnerAt + SHOWDOWN_WINNER_HOLD_MS + SHOWDOWN_AWARD_GAP_MS;
      assert.equal(showdownFlow(f, end - 1).resultsReady, false);
      assert.equal(showdownFlow(f, winnerAt).resultsReady, true);
      assert.equal(showdownFlow(f, winnerAt).awardsReady, false);
      assert.equal(showdownFlow(f, awardAt - 1).awardsReady, false);
      assert.equal(showdownFlow(f, awardAt).awardsReady, true);
    }
  });
}

test("UI masks stacks, final gain and prizes until the winning hand is shown", () => {
  const board = read("../src/PortraitBoard.tsx");
  const table = read("../src/Table.tsx");
  assert.match(board, /won = awardsReady && f\.payouts\[i\] > 0/);
  assert.match(board, /awardsReady \? <strong>\+\{label\(winner\.amount\)\}/);
  assert.match(board, /!awardsReady && f\?\.finished/);
  assert.match(table, /showdownPresentation\.awardsReady && <Result/);
  assert.match(table, /showdownPresentation\.awardsReady && f\?\.finished && f\.diamonds/);
});

test("diamond store is truly Coming Soon with no visible price or purchase API", () => {
  const profile = read("../src/Club.tsx");
  const server = read("../server/start.mjs");
  assert.match(profile, /royale-coming-soon-shop/);
  assert.match(profile, /EM BREVE/);
  assert.doesNotMatch(profile.slice(profile.indexOf("Loja de diamantes"),profile.indexOf("      <form",profile.indexOf("Loja de diamantes"))), /purchase|item\.price|vipPrice|Comprar|Confirmar compra/);
  assert.match(server, /case "buyShop":\s*check\(false,/);
  assert.match(server, /shop: \{ avatars: avatars\.map/);
});
