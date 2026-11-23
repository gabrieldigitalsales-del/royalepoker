import test from 'node:test';
import assert from 'node:assert/strict';
import { syncDealerChoiceAfterSeatChange, prepareDealerChoice, nextDealerSeat } from '../server/dealer-seat-sync.mjs';
const catalog = { texas: {max:10}, om7: {max:6} };
function room(){return {game:'choice',choiceStarted:true,rotation:['texas','om7'],seats:[
{id:'a',stack:100,away:false},{id:'b',stack:100,away:false},{id:'c',stack:100,away:true}
],button:'a',paused:false,closed:false,hand:null,nextChoice:{id:'texas',dealer:'b',selecting:true,openedAt:100,at:5000}};}
test('each new hand assigns selection to the next active dealer, no orbit lock',()=>{
 const r=room();r.choiceOrbit={game:'texas',remaining:5};
 assert.equal(prepareDealerChoice(r,catalog,10000,'om7'),true);
 assert.equal(r.nextChoice.dealer,'b');assert.equal(r.nextChoice.id,'om7');
 assert.equal(r.nextChoice.selecting,true);assert.equal(r.nextChoice.at,15000);
});
test('returning player becomes next selector and gets fresh five seconds',()=>{
 const r=room();r.seats[1].away=true;r.seats[2].away=false;
 assert.equal(syncDealerChoiceAfterSeatChange(r,catalog,10000),true);
 assert.equal(r.nextChoice.dealer,'c');assert.equal(r.nextChoice.selecting,true);
 assert.equal(r.nextChoice.at,15000);assert.equal(r.nextChoice.id,'texas');
});
test('sit out cannot preserve an old orbital lock',()=>{
 const r=room();r.nextChoice.selecting=false;r.choiceOrbit={game:'texas',remaining:2};
 r.seats[1].away=true;r.seats[2].away=false;
 syncDealerChoiceAfterSeatChange(r,catalog,10000);
 assert.equal(r.nextChoice.dealer,'c');assert.equal(r.nextChoice.selecting,true);
});
test('pending choice recovers if second active player returns',()=>{
 const r=room();r.seats[1].away=true;
 assert.equal(syncDealerChoiceAfterSeatChange(r,catalog,10000),true);
 assert.equal(r.nextChoice,undefined);
 r.seats[2].away=false;
 syncDealerChoiceAfterSeatChange(r,catalog,11000);
 assert.equal(r.nextChoice.dealer,'c');assert.equal(r.nextChoice.at,16000);
});
test('paused tables do not restart a selection',()=>{
 const r=room();r.paused=true;r.seats[2].away=false;
 assert.equal(syncDealerChoiceAfterSeatChange(r,catalog,10000),false);
 assert.equal(r.nextChoice.dealer,'b');
});
test('seven-card invalid with seven active players falls back to texas',()=>{
 const r=room();r.nextChoice.id='om7';r.seats=Array.from({length:7},(_,i)=>({id:String(i),stack:100,away:false}));r.button='0';
 syncDealerChoiceAfterSeatChange(r,catalog,10000);
 assert.equal(r.nextChoice.id,'texas');
});
test('a different dealer is entitled every time the button moves',()=>{
 const r=room();r.seats[2].away=false;
 assert.equal(nextDealerSeat(r).id,'b');
 prepareDealerChoice(r,catalog,10000,'texas');
 r.button='b';prepareDealerChoice(r,catalog,20000,'om7');
 assert.equal(r.nextChoice.dealer,'c');assert.equal(r.nextChoice.id,'om7');
});
