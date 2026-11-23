import test from 'node:test';
import assert from 'node:assert/strict';
import {nextUtg, makeRoom} from '../server/game.mjs';
const seats = ['a','b','c','d'].map((id,position)=>({id,position,stack:500,away:false}));
test('Only the next UTG is selected from the next button position',()=>{
 const r={seats,button:'a'};
 // Next dealer b, SB c, BB d, UTG a.
 assert.equal(nextUtg(r)?.id,'a');
 r.button='b';
 assert.equal(nextUtg(r)?.id,'b');
});
test('A sit-out is skipped and heads-up never offers straddle',()=>{
 const r={seats:structuredClone(seats),button:'a'};
 r.seats[2].away=true;
 assert.equal(nextUtg(r)?.id,'b');
 r.seats[3].away=true;
 assert.equal(nextUtg(r),null);
});
test('Cash table starts with straddle available (player must opt in)',()=>{
 const r=makeRoom({id:'host'}, {name:'Table',game:'texas',capacity:4,blind:20,buy:500,seconds:20});
 assert.equal(r.straddleEnabled,true);
 assert.equal(r.seats.length,0);
});
