import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boardResults} from '../src/board-results.mjs';
import {statistics} from '../server/stats.mjs';

const root = new URL('../', import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),'utf8');

test('multiple runout results keep winners separate across side pots',()=>{
  const awards=[
    {boardIndex:0,pot:0,winners:[{index:0,amount:100,cards:['As','Ks','Qs','Js','Ts'],label:'Straight flush'}]},
    {boardIndex:1,pot:0,winners:[{index:1,amount:100,cards:['Ah','Kh','Qh','Jh','Th'],label:'Straight flush'}]},
    {boardIndex:2,pot:0,winners:[{index:0,amount:50,cards:['As','Ks','Qs','Js','Ts']},{index:1,amount:50,cards:['Ah','Kh','Qh','Jh','Th']}]}];
  const boards=boardResults(awards,[{name:'Delex'},{name:'Teste'}],3);
  assert.equal(boards.length,3);
  assert.equal(boards[0].tied,false);
  assert.equal(boards[2].tied,true);
  assert.deepEqual(boards[1].winners.map(x=>x.name),['Teste']);
  assert.equal(boards.flatMap(x=>x.winners).reduce((a,x)=>a+x.amount,0),300);
});

test('VIP statistics report null C-bet until an opportunity is recorded',()=>{
  assert.equal(statistics([], 'u1').cbet,null);
});

test('timeline, reactions, spectator mode and effects setting are present',()=>{
  const table=read('src/Table.tsx');
  assert.match(table,/royale-replay-action-header/);
  assert.match(table,/royale-spectator-status/);
  assert.match(table,/royale-effects/);
  assert.match(table,/"👑", "👏", "🔥"/);
});

test('side pot eligibility only comes from server-defined potDetails',()=>{
  const board=read('src/PortraitBoard.tsx');
  assert.match(board,/f\.potDetails\?\.\[selectedPot\]/);
  assert.match(board,/royale-pot-eligibility/);
});
