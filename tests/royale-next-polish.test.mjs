import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {revealAt, revealDuration} from '../src/runout-reveal.mjs';
import {boardResults} from '../src/board-results.mjs';
const css=readFileSync(new URL('../src/poker-royale-board-system.css',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/PortraitBoard.tsx',import.meta.url),'utf8');

test('three-run board layout uses compact identical slots; table stage itself is not scaled',()=>{
  assert.match(css,/one authoritative layout for multiple community boards/);
  assert.match(css,/royale-boards-3[\s\S]*--royale-community-w/);
  assert.doesNotMatch(css,/scale\(\.5\)/);
  assert.match(view,/royale-board-cluster/);
});
test('shared flop: reveal timing is strictly board 1 then board 2 then board 3',()=>{
  const p={from:3,delay:200,step:100};
  assert.equal(revealAt({...p,runIndex:0,cardIndex:4,elapsed:300}),true);
  assert.equal(revealAt({...p,runIndex:1,cardIndex:3,elapsed:300}),false);
  assert.equal(revealAt({...p,runIndex:1,cardIndex:3,elapsed:400}),true);
  assert.equal(revealAt({...p,runIndex:2,cardIndex:4,elapsed:700}),true);
  assert.equal(revealDuration({runs:3,...p}),700);
});
test('side pot eligibility and title read actual hand players and selection resets each hand',()=>{
  assert.match(view,/handPlayers\[seatIndex\]\?\.name/);
  assert.match(view,/useEffect\(\(\) => setSelectedPot\(null\), \[h\?\.id\]\)/);
});
test('different winners of different side pots do not mean a tie',()=>{
  const players=[{name:'A'},{name:'B'},{name:'C'}];
  const result=boardResults([{boardIndex:0,pot:0,winners:[{index:0,amount:100}]},{boardIndex:0,pot:1,winners:[{index:1,amount:80}]}],players,1)[0];
  assert.equal(result.tied,false);
  assert.equal(result.winners.length,2);
});
