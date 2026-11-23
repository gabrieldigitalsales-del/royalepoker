import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,deal} from '../server/game.mjs';
import {stop} from '../server/worker.mjs';
after(stop);
test('Bomb Pot de 5 em 5 mãos ativa no quinto deal, pula pré-flop e preserva o ante',async()=>{
 const u={id:'owner',name:'Owner',wallet:3000};
 const v={id:'friend',name:'Friend',wallet:3000};
 const d={users:{owner:u,friend:v},hands:{}};
 const r=makeRoom(u,{game:'texas',name:'Mesa',capacity:6,blind:20,buy:1000,seconds:25,bombInterval:5,bombAnteMultiplier:3});
 r.seats=[{id:u.id,position:0,stack:1000,bought:1000},{id:v.id,position:1,stack:1000,bought:1000}];
 r.count=4;
 await deal(d,r);
 assert.equal(r.hand.h.bomb,true);assert.equal(r.hand.h.bombAnte,60);
 assert.equal(r.hand.h.frames[0].board.length,3);
 assert.equal(r.hand.h.frames[0].pot,120);
});
