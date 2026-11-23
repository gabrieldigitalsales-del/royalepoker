import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { showdownFlow, SHOWDOWN_RESULTS_GAP_MS } from "../src/showdown-flow.mjs";
import { revealAt } from "../src/runout-reveal.mjs";

test("three runouts reveal every board before announcing winners", () => {
  const frame = {
    finished: true, runoutFrom: 3, runoutCount: 3,
    board: ["As", "Kd", "Qh", "Jc", "2s"],
    boards: [
      ["As", "Kd", "Qh", "Jc", "2s"],
      ["As", "Kd", "Qh", "Th", "3c"],
      ["As", "Kd", "Qh", "9d", "4c"],
    ],
    runoutDelay: 650, runoutStep: 530,
  };
  const end = showdownFlow(frame, 0, false).runoutEnd;
  const lastCardAt = showdownFlow(frame, 0).lastCardAt;
  assert.ok(end > 0);
  assert.equal(revealAt({ runIndex: 2, cardIndex: 4, from: 3, elapsed: lastCardAt - 1, delay: 650, step: 530 }), false);
  assert.equal(revealAt({ runIndex: 2, cardIndex: 4, from: 3, elapsed: lastCardAt, delay: 650, step: 530 }), true);
  assert.equal(showdownFlow(frame, end + SHOWDOWN_RESULTS_GAP_MS - 1, false).resultsReady, false);
  assert.equal(showdownFlow(frame, end + SHOWDOWN_RESULTS_GAP_MS, false).resultsReady, true);
});

test("the empty seat number remains a real touch target", () => {
  const board = readFileSync(new URL("../src/PortraitBoard.tsx", import.meta.url), "utf8");
  const table = readFileSync(new URL("../src/Table.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/poker-royale-seats-finish.css", import.meta.url), "utf8");
  assert.match(board, /onClick=\{\(\) => onSeat\(perspective\.physical\(index\)\)\}/);
  assert.match(table, /r\.seats\.length < r\.capacity/);
  assert.match(css, /button\.empty-chair\.seat-option/);
  assert.match(css, /pointer-events:\s*auto\s*!important/);
});

test("16 illustrated avatars use a server-owned selection", () => {
  const profile = readFileSync(new URL("../src/PlayerIdentity.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/start.mjs", import.meta.url), "utf8");
  assert.match(profile, /freeAvatarNames\.map/);
  assert.match(profile, /selectFreeAvatar/);
  assert.match(server, /case "selectFreeAvatar":/);
  assert.match(server, /\.int\(\)\.min\(0\)\.max\(15\)/);
});
