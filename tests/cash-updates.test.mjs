import { test, after } from "node:test";
import assert from "node:assert/strict";
import { training } from "../server/training.mjs";
import { stop, step } from "../server/worker.mjs";
import { recordWallets, rakeReport } from "../server/cash-updates.mjs";
import { betPresets } from "../src/bet-presets.mjs";
after(stop);
for (const game of ["texas", "om4"])
  test("Treino isolado até o showdown ou fold · " + game, async () => {
    const u = { name: "Teste", wallet: 123 };
    let h = await training(u, { cmd: "practiceStart", game });
    assert.deepEqual(await training(u, { cmd: "practiceResume" }), h);
    assert.ok(
      h.frames[0].hole[h.players.findIndex((p) => p.id === "bot")].every(
        (c) => c === null,
      ),
    );
    await assert.rejects(
      training(u, {
        cmd: "practiceMove",
        hand: h.id,
        rev: h.rev - 1,
        action: { type: "pass" },
      }),
    );
    for (let i = 0; i < 30 && !h.frames[0].finished; i++)
      h = await training(u, {
        cmd: "practiceMove",
        hand: h.id,
        rev: h.rev,
        action: { type: "pass" },
      });
    assert.equal(h.frames[0].finished, true);
    assert.equal(
      h.frames[0].stacks.reduce((a, b) => a + b),
      2000,
    );
    assert.equal(u.wallet, 123);
  });
test("Extrato separa o rake do resgate e preserva saldo anterior", () => {
  const before = { users: { a: { wallet: 950, rakeEarned: 4 } } };
  const next = { users: { a: { wallet: 1106, rakeEarned: 10 } } };
  recordWallets(before, next, "leave");
  assert.deepEqual(
    next.users.a.walletLog.map((e) => [e.amount, e.balance]),
    [
      [6, 956],
      [150, 1106],
    ],
  );
  recordWallets(next, structuredClone(next), "leave");
  assert.equal(next.users.a.walletLog.length, 2);
});
test("Conferência do rake em pote dividido", () => {
  const [r] = rakeReport({
    h: { frames: [{ grossPot: 200, rake: 6, payouts: [97, 97] }] },
  });
  assert.equal(r.gross, r.distributed + r.fee);
});
test("Presets ordenados, distintos e dentro do stack curto", () => {
  const f = { bets: [5, 15], actor: 0, board: [], pot: 20, stacks: [35, 150] };
  const p = betPresets({ min: 25, max: 40, call: 10 }, f, 10, "PL");
  assert.deepEqual(
    p.map((a) => a[1]),
    [25, 30, 38, 40],
  );
  assert.equal(p.at(-1)[0], "All-in");
});
test("Três all-ins preflop preservam pote principal, lateral e devolução", async () => {
  let h = await step({ game: "texas", stacks: [30, 70, 120], blind: 10 });
  while (!h.frame.finished) {
    const l = h.frame.legal;
    h = await step({
      state: h.state,
      action: l.max ? { type: "raise", amount: l.max } : { type: "pass" },
    });
  }
  assert.equal(h.frame.board.length, 5);
  assert.deepEqual(
    h.frame.potDetails.map((p) => p.amount),
    [90, 80],
  );
  assert.deepEqual(
    h.frame.potDetails.map((p) => p.eligible.length),
    [3, 2],
  );
  assert.equal(
    h.frame.stacks.reduce((a, b) => a + b),
    220,
  );
});
