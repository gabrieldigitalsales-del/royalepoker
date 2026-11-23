import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { takeRake, grossPayoutsFor, publicGrossResult } from "../server/progression.mjs";
import { rakeReport } from "../server/cash-updates.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Gross profit 521 remains visible, but actual post-rake profit is 490", () => {
  const frame = {
    payouts: [1042, 0], stacks: [1042, 0], rows: null,
    awards: [{ winners: [{ index: 0, amount: 1042 }] }],
  };
  const fee = takeRake(frame, 3);
  assert.equal(fee, 31);
  assert.deepEqual(frame.payouts, [1011, 0]);
  assert.equal(frame.stacks[0] - 521, 490, "actual chips reflect the rake");
  assert.deepEqual(grossPayoutsFor(frame), [1042, 0]);
  assert.equal(publicGrossResult(frame, { stack: 521 }, 0), 521);
  assert.deepEqual(frame.rakeShares, [31, 0]);
  const history = rakeReport({ h: { id: "h", name: "Mesa Royal", number: 7,
    ended: 12345, frames: [frame] } });
  assert.equal(history[0].fee, 31);
  assert.equal(history[0].percent, 3);
});

test("Older hands without rakeShares keep gross display without changing balances", () => {
  const older = { payouts: [1011, 0], stacks: [1011, 0], rake: 31, grossPot: 1042 };
  assert.deepEqual(grossPayoutsFor(older), [1042, 0]);
  assert.equal(publicGrossResult(older, { stack: 521 }, 0), 521);
});

test("Avatar chosen in profile reaches seat view and uses the same illustration sprite", () => {
  const face = read("../src/PlayerIdentity.tsx");
  const table = read("../src/PortraitBoard.tsx");
  const game = read("../server/game.mjs");
  const css = read("../src/poker-royale-photo-fix.css");
  assert.match(face, /showFreeAvatar/);
  assert.match(table, /<Face player=\{r\.seats\?\.find/);
  assert.match(game, /freeAvatar: Number\.isInteger\(d\.users\[seat\.id\]\.freeAvatar\)/);
  assert.match(css, /portrait-avatar:has\(> \.player-face--free\)/);
  assert.match(css, /background-size: 400% 400% !important/);
});

test("Player history shows gross results without publishing rake breakdown", () => {
  const game = read("../server/game.mjs");
  const panel = read("../src/Club.tsx");
  const table = read("../src/Table.tsx");
  assert.match(game, /grossNet: ownIndex < 0/);
  assert.match(panel, /r\.grossNet \?\? r\.net/);
  assert.match(table, /player\.grossNet \?\? player\.net/);
  assert.match(panel, /hand\.percent/);
});
