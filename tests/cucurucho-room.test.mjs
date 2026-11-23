import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,deal,move} from '../server/game.mjs';
import {stop} from '../server/worker.mjs';
after(stop);
test('Cucurucho dispara quando botão dealer encontra marcador',async()=>{
 const users={a:{id:'a',name:'Alice',wallet:10000},b:{id:'b',name:'Bob',wallet:10000},c:{id:'c',name:'Carol',wallet:10000}};
 const d={users,hands:{}};
 const r=makeRoom(users.a,{game:'texas',name:'Sala',capacity:6,blind:20,buy:1000,seconds:25,cucuruchoEnabled:true,cucuruchoAnteMultiplier:2});
 r.seats=Object.values(users).map((u,i)=>({id:u.id,position:i,stack:1000,bought:1000}));
 r.button='a';r.cucuruchoMarker='b';r.count=1;
 await deal(d,r);
 assert.equal(r.hand.h.cucurucho,true);
 assert.equal(r.hand.h.cucuruchoAnte,40);
 assert.equal(r.hand.h.frames[0].pot,120);
 // Official Cucurucho: ante and immediate flop, with a stay-or-fold decision.
 assert.equal(r.hand.h.frames[0].board.length,3);
 assert.equal(r.hand.h.frames[0].legal.cucu,120);
});
