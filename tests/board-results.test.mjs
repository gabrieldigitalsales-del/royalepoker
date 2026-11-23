import test from 'node:test';
import assert from 'node:assert/strict';
import {boardResults} from '../src/board-results.mjs';
const players=[{name:'Delex'},{name:'Gabriel'},{name:'Ana'}];
test('each runout identifies its own winning five cards and winner',()=>{
 const rows=boardResults([
  {boardIndex:0,pot:0,winners:[{index:0,amount:100,cards:['As','Ks','Qs','Js','Ts'],label:'Straight flush'}]},
  {boardIndex:1,pot:0,winners:[{index:1,amount:100,cards:['Ac','Ad','Ah','Kc','Kd'],label:'Full house'}]},
  {boardIndex:2,pot:0,winners:[{index:2,amount:100,cards:['2c','3c','4c','5c','6c'],label:'Straight flush'}]},
 ],players,3);
 assert.deepEqual(rows.map(r=>r.winners[0].name),['Delex','Gabriel','Ana']);
 assert.equal(rows[1].winningCards.length,5);
 assert.deepEqual(rows.map(r=>r.tied),[false,false,false]);
});
test('draw only if one pot award has multiple winners',()=>{
 const rows=boardResults([
  {boardIndex:0,pot:0,winners:[{index:0,amount:50},{index:1,amount:50}]},
  {boardIndex:1,pot:0,winners:[{index:0,amount:70}]},
  {boardIndex:1,pot:1,winners:[{index:1,amount:20}]},
 ],players,2);
 assert.equal(rows[0].tied,true);
 assert.equal(rows[1].tied,false);
});

test('side pots aggregate payouts but keep one five-card winning hand per run',()=>{
 const rows=boardResults([
  {boardIndex:0,pot:0,winners:[{index:0,amount:120,cards:['As','2s','3c','4d','5h'],label:'Straight'}]},
  {boardIndex:0,pot:1,winners:[{index:0,amount:30,cards:['As','2s','3c','4d','5h'],label:'Straight'}]},
  {boardIndex:1,pot:0,winners:[{index:1,amount:80,cards:['Ac','Kc','Qc','Jc','Tc'],label:'Straight flush'}]},
  {boardIndex:2,pot:0,winners:[{index:2,amount:70,cards:['2h','2d','2c','9s','9d'],label:'Full house'}]},
 ],players,3);
 assert.deepEqual(rows.map(r=>r.winners.length),[1,1,1]);
 assert.equal(rows[0].winners[0].amount,150);
 assert.deepEqual(rows.map(r=>r.winners[0].bestCards.length),[5,5,5]);
});
