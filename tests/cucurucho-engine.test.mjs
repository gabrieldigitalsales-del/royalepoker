import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {step,stop} from '../server/worker.mjs';
import {makeRoom,deal} from '../server/game.mjs';
after(stop);
test('Cucurucho exige pagamento do pote após o flop e vai ao showdown', async()=>{
 let x=await step({game:'texas',blind:20,stacks:[1000,1000,1000],cucurucho:true,cucuruchoAnte:100,runout:false});
 assert.equal(x.frame.pot,300);
 for(let n=0;n<30 && !x.frame.finished;n++){
  const l=x.frame.legal;
  const action=l.cucu!=null?{type:'cucuStay'}:l.fold?{type:'fold'}:null;
  assert.ok(action,'ação Cucurucho esperada');
  x=await step({state:x.state,action});
 }
 assert.ok(x.frame.finished);assert.equal(x.frame.stacks.reduce((a,b)=>a+b),3000);
 assert.equal(x.frame.boards[0].length,5);
});
test('Cucurucho: jogador sem fichas para pagar o pote pode desistir',async()=>{
 let x=await step({game:'texas',blind:20,stacks:[120,1000,1000],cucurucho:true,cucuruchoAnte:100,runout:false});
 assert.equal(x.frame.legal.cucu,undefined);
 assert.equal(x.frame.legal.fold,true);
 x=await step({state:x.state,action:{type:'fold'}});
 assert.equal(x.frame.active[0],false);
});
test('sala aceita Cucurucho configurável por ante',()=>{
 const r=makeRoom({id:'a'},{game:'texas',name:'Mesa',capacity:6,blind:20,buy:1000,seconds:25,cucuruchoEnabled:true,cucuruchoAnteMultiplier:5});
 assert.equal(r.cucuruchoEnabled,true);assert.equal(r.cucuruchoAnteMultiplier,5);
});
