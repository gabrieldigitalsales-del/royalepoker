import test, { after } from "node:test";
import assert from "node:assert/strict";
import { catalog, dealerGames } from "../server/catalog.mjs";
import { ensureDealerChoiceModes } from "../server/dealer-choice-modes.mjs";
import { makeRoom } from "../server/game.mjs";
import { stop } from "../server/worker.mjs";
after(stop);

test("Double Board 5/6 e Omaha 7 existem e são oferecidos no catálogo", () => {
  for (const id of ["om5db", "om6db", "om7"]) {
    assert.ok(catalog[id], `${id} não cadastrado`);
    assert.ok(dealerGames.includes(id), `${id} não está no Dealer's Choice`);
    assert.equal(catalog[id].max, 6);
  }
});

test("Mesas antigas ganham os modos faltantes sem perder suas opções", () => {
  const room = { game: "choice", rotation: ["texas", "om4", "om7"] };
  assert.equal(ensureDealerChoiceModes(room), true);
  assert.deepEqual(room.rotation, ["texas", "om4", "om7", "om5db", "om6db"]);
  assert.equal(ensureDealerChoiceModes(room), false);
});

test("Outras modalidades não são modificadas", () => {
  const room = { game: "custom", rotation: ["texas"] };
  assert.equal(ensureDealerChoiceModes(room), false);
  assert.deepEqual(room.rotation, ["texas"]);
});

test("Mesa Dealer's Choice nova inclui Double Boards e Omaha 7", () => {
  const room = makeRoom({ id: "owner" }, { name: "Teste", game: "choice", capacity: 6, blind: 10, buy: 100, seconds: 25 });
  for (const id of ["om5db", "om6db", "om7"]) assert.ok(room.rotation.includes(id));
});
