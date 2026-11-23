import test from 'node:test';
import assert from 'node:assert/strict';
import { step, stop } from '../server/worker.mjs';
import { makeRoom } from '../server/game.mjs';
import { after } from 'node:test';
after(stop);
test('frequência e ante do Bomb Pot são persistidos em nova mesa', () => {
 const r=makeRoom({id:'owner'}, {game:'texas',name:'Teste',capacity:6,blind:20,buy:1000,seconds:25,bombInterval:5,bombAnteMultiplier:3});
 assert.equal(r.bombInterval,5);assert.equal(r.bombAnteMultiplier,3);
});
for (const game of ['texas','om5','om6db']) {
 test('Bomb Pot '+game+' inicia no flop e conserva fichas', async () => {
 let x=await step({game,stacks:[1000,1000,1000],blind:20,bomb:true,bombAnte:40,runout:false});
 assert.equal(x.frame.board.length,3);assert.equal(x.frame.pot,120);
 for(let i=0;i<50 && !x.frame.finished;i++){
  assert.ok('call' in x.frame.legal,'deveria existir check/call no Bomb Pot');
  x=await step({state:x.state,action:{type:'pass'}});
 }
 assert.ok(x.frame.finished);assert.equal(x.frame.stacks.reduce((a,b)=>a+b,0),3000);
 assert.equal(x.frame.boards.length,game.endsWith('db')?2:1);
 });
}
