import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {step,stop} from '../server/worker.mjs';
import {makeRoom,deal} from '../server/game.mjs';
after(stop);
test('Cucurucho heads-up: two players ante, flop, stay and fold',async()=>{
 let x=await step({game:'texas',blind:20,stacks:[1000,1000],cucurucho:true,cucuruchoAnte:40,runout:false});
 assert.equal(x.frame.board.length,3); assert.equal(x.frame.pot,80);
 for(let n=0;n<5 && !x.frame.finished;n++){
  assert.equal(x.frame.legal.cucu,80);
  x=await step({state:x.state,action:{type:'cucuStay'}});
 }
 assert.equal(x.frame.finished,true); assert.equal(x.frame.stacks.reduce((a,b)=>a+b),2000);
 let y=await step({game:'texas',blind:20,stacks:[1000,1000],cucurucho:true,cucuruchoAnte:40,runout:false});
 y=await step({state:y.state,action:{type:'fold'}});
 assert.equal(y.frame.finished,true);assert.equal(y.frame.stacks.reduce((a,b)=>a+b),2000);
});
test('Cucurucho heads-up first deal selects visible marker and plays',async()=>{
 const users={a:{id:'a',name:'A',wallet:10000},b:{id:'b',name:'B',wallet:10000}};
 const r=makeRoom(users.a,{game:'texas',name:'HU',capacity:2,blind:20,buy:1000,seconds:25,cucuruchoEnabled:true,cucuruchoAnteMultiplier:2});
 r.seats=Object.values(users).map((u,i)=>({id:u.id,position:i,stack:1000,bought:1000}));
 r.button='a';
 await deal({users,hands:{}},r);
 assert.equal(r.hand.h.cucurucho,true);
 assert.equal(r.cucuruchoMarker,r.button);
});
