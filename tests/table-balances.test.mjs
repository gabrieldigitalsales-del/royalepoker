import { test } from "node:test";
import assert from "node:assert/strict";
import { tableBalances } from "../server/table-balances.mjs";
test("Placar separa presença de assento e mantém saldo ao voltar", () => {
  const delex = { id: "d", name: "Delex" }, ana = { id: "a", name: "Ana" }, leo = { id: "l", name: "Leo" };
  const view = {
    seats: [delex, leo, { id: "s", name: "Só entrou" }],
    live: { players: [delex, leo] },
    history: [{ participants: [delex, ana] }, { participants: [ana, delex] }],
    results: { d: { won: 800, lost: 300, hands: 2 }, a: { won: 300, lost: 800, hands: 2 } },
  };
  const online = new Set(["d", "a"]);
  const rows = tableBalances(view, {}, online);
  assert.deepEqual(rows.map(r => [r.id, r.net, r.online, r.seated]), [
    ["d", 500, true, true], ["a", -500, true, false], ["l", 0, false, true], ["s", 0, false, true],
  ]);
  view.seats = [ana]; online.delete("d");
  const d = tableBalances(view, {}, online).find(r => r.id === "d");
  assert.equal(d.net, 500); assert.equal(d.online, false); assert.equal(d.seated, false);
  view.seats = [delex, ana]; online.add("d");
  assert.equal(tableBalances(view, {}, online).find(r => r.id === "d").seated, true);
});
test("Placar inclui quem acabou de sentar, antes da primeira mão, e ordena por presença", () => {
  const rows = tableBalances({ seats: [{id:"novo",name:"Jogador novo"}], history:[], results:{} }, {}, new Set(["novo"]));
  assert.equal(rows.length,1);
  assert.deepEqual([rows[0].online,rows[0].seated,rows[0].net,rows[0].hands],[true,true,0,0]);
});
test("Placar mantém resultado de jogador que saiu e ficou offline", () => {
  const rows = tableBalances({seats:[],history:[{participants:[{id:"d",name:"Delex"}]}],results:{d:{won:600,lost:100,hands:4}}},{},new Set());
  assert.deepEqual([rows[0].name,rows[0].net,rows[0].online,rows[0].seated],["Delex",500,false,false]);
});
