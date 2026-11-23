import test, { after } from "node:test";
import assert from "node:assert/strict";
import { step, stop } from "../server/worker.mjs";
import { takeRake } from "../server/progression.mjs";
import { catalog, rotations } from "../server/catalog.mjs";
import { automatic, viewFrame, deal, move } from "../server/game.mjs";
after(stop);
for (const g of Object.values(catalog).filter((g) => g.family !== "Mistos"))
  test(g.name + " · mão completa e reconexão", async () => {
    const stacks = [300, 300, 300],
      players = stacks.map((_, i) => ({ id: String(i) }));
    let r = await step({ game: g.id, blind: 10, stacks }),
      count = 0;
    while (!r.frame.finished) {
      const f = r.frame,
        i = f.actor;
      assert.ok(Number.isInteger(i));
      const spectator = viewFrame({ players }, f, "spectator");
      f.hole.forEach((cards, j) =>
        cards.forEach((c, k) => {
          if (!f.public[j][k]) assert.equal(spectator.hole[j][k], null);
        }),
      );
      if (count === 0) {
        await assert.rejects(
          step({ state: r.state, action: { type: "invalid" } }),
        );
        if (g.id === "cour") assert.equal(f.board.length, 1);
        if (g.id === "short")
          assert.ok(f.hole.flat().every((c) => "6789TJQKA".includes(c[0])));
      }
      const act = automatic(f);
      if ("call" in f.legal) act.type = "pass";
      if ("draw" in f.legal && count % 2 === 0 && !f.legal.required)
        act.cards = f.hole[i].slice(0, 1);
      r = await step({
        state: JSON.parse(JSON.stringify(r.state)),
        action: act,
      });
      assert.ok(++count < 150);
    }
    assert.equal(
      r.frame.stacks.reduce((a, b) => a + b),
      900,
    );
    if (g.family === "Chinês") {
      assert.deepEqual(
        r.frame.rows[0].map((x) => x.length),
        [3, 5, 5],
      );
      assert.equal(
        r.frame.payouts.reduce((a, b) => a + b),
        0,
      );
    } else assert.ok(r.frame.payouts.reduce((a, b) => a + b) > 0);
  });
for (const [name, seq] of Object.entries({
  ...rotations,
  custom: ["draw", "texas"],
  choice: ["om4", "stud"],
}))
  test(name + " · duas voltas", async () => {
    const r = {
      id: "r",
      name: "mix",
      game: name,
      rotation: seq,
      blind: 10,
      seconds: 45,
      count: 0,
      rev: 0,
      seats: [
        { id: "a", stack: 300 },
        { id: "b", stack: 300 },
      ],
    };
    for (let i = 0; i < seq.length * 2; i++) {
      await deal(
        { users: { a: { name: "A" }, b: { name: "B" } } },
        r,
        seq[i % seq.length],
      );
      assert.equal(r.hand.h.game, seq[i % seq.length]);
      r.hand = null;
    }
  });
test("all-ins com três stacks e side pot", async () => {
  let r = await step({ game: "texas", blind: 10, stacks: [30, 65, 100] });
  while (!r.frame.finished) {
    const l = r.frame.legal;
    r = await step({
      state: r.state,
      action: l.max ? { type: "raise", amount: l.max } : { type: "pass" },
    });
  }
  assert.equal(
    r.frame.stacks.reduce((a, b) => a + b),
    195,
  );
  assert.ok(r.frame.payouts.filter((x) => x > 0).length > 0);
});
test("Crazy Pineapple all-in mantém o descarte privado até o fim", async () => {
  let r = await step({ game: "crazy", blind: 10, stacks: [80, 80] });
  const discards = [];
  while (!r.frame.finished) {
    const f = r.frame,
      l = f.legal;
    if (l.draw) {
      assert.ok(f.public.flat().every((v) => !v));
      discards[f.actor] = f.hole[f.actor][0];
    }
    r = await step({
      state: r.state,
      action: l.draw
        ? { type: "draw", cards: [discards[f.actor]] }
        : l.max
          ? { type: "raise", amount: l.max }
          : { type: "pass" },
    });
  }
  r.frame.hole.forEach((cards, i) => {
    assert.equal(cards.length, 2);
    assert.ok(!cards.includes(discards[i]));
  });
});

for (const game of ["texas", "limit", "om4"]) {
  test(game + " · dez assentos e combinação privada", async () => {
    const players = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }));
    let { frame, state } = await step({
      game,
      blind: 10,
      stacks: Array(10).fill(300),
    });
    assert.equal(frame.hole.length, 10);
    while (!frame.finished && frame.board.length < 5) {
      ({ frame, state } = await step({ state, action: { type: "pass" } }));
      if (frame.board.length >= 3) {
        const own = viewFrame({ players }, frame, "0");
        assert.ok(own.combinations[0].length);
        assert.ok(
          own.combinations.slice(1).every((labels) => labels.length === 0),
        );
      }
    }
    assert.equal(frame.board.length, 5);
  });
}

test("tempo esgotado desiste mesmo quando passar era possível", async () => {
  let hand = await step({ game: "texas", blind: 10, stacks: [300, 300] });
  hand = await step({ state: hand.state, action: { type: "pass" } });
  assert.equal(hand.frame.legal.call, 0);
  const result = await step({
    state: hand.state,
    action: automatic(hand.frame, true),
  });
  assert.equal(result.frame.finished, true);
  assert.equal(result.frame.payouts[hand.frame.actor], 0);
});

test("Watermelon all-in descarta após flop e turn", async () => {
  let r = await step({ game: "watermelon", blind: 10, stacks: [80, 80] });
  assert.deepEqual(
    r.frame.hole.map((cards) => cards.length),
    [4, 4],
  );
  const stages = [];
  while (!r.frame.finished) {
    const f = r.frame;
    if (f.legal.required) {
      stages.push(f.board.length);
      assert.ok(f.public.flat().every((open) => !open));
    }
    const action = f.legal.required
      ? automatic(f)
      : f.legal.max
        ? { type: "raise", amount: f.legal.max }
        : { type: "pass" };
    r = await step({ state: r.state, action });
  }
  assert.deepEqual(stages, [3, 3, 4, 4]);
  assert.deepEqual(
    r.frame.hole.map((cards) => cards.length),
    [2, 2],
  );
});

test("call all-in com stack menor paga só as fichas disponíveis", async () => {
  let result = await step({ game: "texas", blind: 10, stacks: [25, 100] });
  result = await step({
    state: result.state,
    action: { type: "raise", amount: 100 },
  });
  const { actor, legal, stacks, bets } = result.frame;
  assert.equal(actor, 0);
  assert.equal(legal.call, 15);
  assert.equal(legal.call, stacks[actor]);
  assert.ok(Math.max(...bets) - bets[actor] > legal.call);
  assert.equal(legal.min, undefined);
  result = await step({ state: result.state, action: { type: "pass" } });
  assert.equal(result.frame.finished, true);
  assert.equal(result.frame.board.length, 5);
  assert.equal(
    result.frame.payouts.reduce((total, amount) => total + amount, 0),
    50,
  );
  assert.equal(
    result.frame.stacks.reduce((total, amount) => total + amount, 0),
    125,
  );
  assert.ok(result.frame.stacks[1] >= 75);
});

test("a mesa registra o excedente devolvido e quem disputa o pote", async () => {
  const d = { hands: {}, users: { a: { name: "A" }, b: { name: "B" } } };
  const r = {
    id: "short",
    game: "texas",
    seats: [
      { id: "a", stack: 100 },
      { id: "b", stack: 25 },
    ],
    rotation: [],
    blind: 10,
    seconds: 25,
    count: 0,
    rev: 0,
  };
  await deal(d, r);
  await move(d, r, "a", { rev: r.rev, action: { type: "raise", amount: 100 } });
  await move(d, r, "b", { rev: r.rev, action: { type: "pass" } });
  const final = d.hands[r.last].frames.at(-1);
  assert.equal(final.paid, 15);
  assert.equal(final.refunds[0].amount, 75);
  assert.equal(d.hands[r.last].players[final.refunds[0].index].id, "a");
  assert.deepEqual(final.potDetails, [{ amount: 50, eligible: [0, 1] }]);
});

test("rake de 3% conserva fichas com pote dividido e lateral", () => {
  const frame = {
    stacks: [150, 100, 50],
    payouts: [150, 100, 0],
    awards: [
      {
        pot: 0,
        winners: [
          { index: 0, amount: 75 },
          { index: 1, amount: 75 },
        ],
      },
      {
        pot: 1,
        winners: [
          { index: 0, amount: 75 },
          { index: 1, amount: 25 },
        ],
      },
    ],
  };
  assert.equal(takeRake(frame), 7);
  assert.equal(frame.grossPot, 250);
  assert.equal(
    frame.payouts.reduce((a, b) => a + b, 0),
    243,
  );
  assert.equal(frame.stacks.reduce((a, b) => a + b, 0) + frame.rake, 300);
  assert.equal(
    frame.awards
      .flatMap((award) => award.winners)
      .reduce((total, winner) => total + winner.amount, 0),
    243,
  );
});
