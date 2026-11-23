import { test } from "node:test";
import assert from "node:assert/strict";
import { diamondAwards } from "../server/rewards.mjs";
test("Diamantes por cota bruta, por jogador e por pote", () => {
  for (const [chips, expected] of [
    [99999, 0],
    [100000, 1],
    [299999, 2],
  ])
    assert.deepEqual(diamondAwards({ payouts: [chips, 0] }), [expected, 0]);
  assert.deepEqual(
    diamondAwards({
      payouts: [120000, 100000],
      awards: [
        {
          pot: 0,
          winners: [
            { index: 0, amount: 60000 },
            { index: 1, amount: 100000 },
          ],
        },
        { pot: 1, winners: [{ index: 0, amount: 60000 }] },
      ],
    }),
    [0, 1],
  );
});
