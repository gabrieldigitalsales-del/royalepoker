import test,{after} from 'node:test';
import {stop,step} from '../server/worker.mjs';
after(stop);
import assert from 'node:assert/strict';
import {catalog,dealerGames} from '../server/catalog.mjs';
import {makeRoom} from '../server/game.mjs';
import {upgradeDealerRotation,legacyDealerRotation,currentDealerRotation} from '../server/dealer-rotation.mjs';
test('Double Board 5/6 and Omaha 7 present in default Dealer Choice',()=>{
 for(const id of ['om5db','om6db','om7']) {
  assert.ok(dealerGames.includes(id));
  assert.ok(catalog[id]);
 }
 assert.equal(catalog.om7.max,6);
 assert.equal(catalog.om5db.max,6);
 assert.equal(catalog.om6db.max,6);
});
test('Old default choice list gets two new Double Board modes',()=>{
 const updated=upgradeDealerRotation(legacyDealerRotation);
 assert.deepEqual(updated,currentDealerRotation);
 assert.ok(updated.indexOf('om5db')<updated.indexOf('om7'));
});
test('Custom choices remain unchanged',()=>{
 assert.deepEqual(upgradeDealerRotation(['texas','om7']),['texas','om7']);
});
test('New Dealer Choice room has Double Board games by default',()=>{
 const room=makeRoom({id:'owner'}, {game:'choice',name:'Mesa',capacity:6,blind:10,buy:100,seconds:25,timeBank:0});
 assert.ok(room.rotation.includes('om5db'));
 assert.ok(room.rotation.includes('om6db'));
 assert.ok(room.rotation.includes('om7'));
});

test('Omaha 7 distributes seven hole cards to six players',async()=>{
 const dealt=await step({game:'om7',blind:10,stacks:Array(6).fill(200),runout:false});
 assert.equal(dealt.frame.hole.length,6);
 assert.ok(dealt.frame.hole.every(cards=>cards.length===7));
});
