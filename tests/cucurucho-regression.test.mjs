import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { step, stop } from '../server/worker.mjs';
import { deal,makeRoom,move } from '../server/game.mjs';
after(stop);
async function start(game='texas', stacks=[1000,1000,1000], ante=60){
 return step({game,blind:20,stacks,cucurucho:true,cucuruchoAnte:ante,runout:false});
}
for (const game of ['texas','om4','om5','om6','om7']){
 test(`Cucurucho ${game}: três jogadores pagam, recebe flop e encerra sem nova aposta`, async()=>{
  let x=await start(game);
  assert.equal(x.frame.board.length,3);
  assert.equal(x.frame.pot,180);
  assert.equal(x.frame.legal.cucu,180);
  let actions=0;
  while(!x.frame.finished && actions++<10){
   assert.equal(x.frame.legal.cucu,180);
   x=await step({state:x.state,action:{type:'cucuStay'}});
  }
  assert.ok(x.frame.finished);
  assert.equal(x.frame.board.length,5);
  assert.equal(x.frame.stacks.reduce((a,b)=>a+b),3000);
  assert.equal(x.frame.payouts.reduce((a,b)=>a+b),720);
 });
}
test('Cucurucho: desistir com todos os jogadores preserva fichas',async()=>{
 let x=await start();
 for(let j=0;j<3 && !x.frame.finished;j++){
  assert.equal(x.frame.legal.fold,true);
  x=await step({state:x.state,action:{type:'fold'}});
 }
 assert.ok(x.frame.finished);
 assert.equal(x.frame.stacks.reduce((a,b)=>a+b),3000);
});
test('Cucurucho: stack curto não pode pagar e ação ilegal rejeitada',async()=>{
 let x=await start('texas',[120,1000,1000],100);
 assert.equal(x.frame.legal.cucu,undefined);
 await assert.rejects(step({state:x.state,action:{type:'cucuStay'}}),/Fichas insuficientes/);
 await assert.rejects(step({state:x.state,action:{type:'pass'}}),/Somente Ficar/);
 x=await step({state:x.state,action:{type:'fold'}});
 assert.equal(x.frame.active[0],false);
 while(!x.frame.finished){x=await step({state:x.state,action:{type:'cucuStay'}});}
 assert.equal(x.frame.stacks.reduce((a,b)=>a+b),2120);
});
test('Cucurucho: dobra da mesa não é aplicada nas modalidades Double Board',async()=>{
 await assert.rejects(start('om6db'),/Cucurucho permitido somente/);
});
test('Cucurucho: servidor registra a compra uma única vez e mantém rev',async()=>{
 const users=Object.fromEntries(['a','b','c'].map((id,i)=>[id,{id,name:'J'+i,wallet:10000}]));
 const d={users,hands:{}};
 const r=makeRoom(users.a,{game:'texas',name:'Cucu',capacity:6,blind:20,buy:1000,seconds:25,cucuruchoEnabled:true,cucuruchoAnteMultiplier:3});
 r.seats=Object.values(users).map((u,i)=>({id:u.id,position:i,stack:1000,bought:1000}));
 r.button='a';r.cucuruchoMarker='b';
 await deal(d,r);
 assert.equal(r.hand.h.cucurucho,true);
 let f=r.hand.h.frames.at(-1);
 assert.equal(f.legal.cucu,180);
 const actor=r.hand.h.players[f.actor].id;
 const previous=r.rev;
 await move(d,r,actor,{rev:previous,action:{type:'cucuStay'}});
 assert.equal(r.rev,previous+1);
 await assert.rejects(move(d,r,actor,{rev:previous,action:{type:'cucuStay'}}),/atualizada/);
 const newFrame=r.hand.h.frames.at(-1);
 assert.equal(newFrame.paid,180);
});
test('Cucurucho: todos all-in no ante concluem direto e conservam fichas',async()=>{
 const x=await start('texas',[100,100,100],100);
 assert.equal(x.frame.finished,true);
 assert.equal(x.frame.board.length,5);
 assert.equal(x.frame.stacks.reduce((a,b)=>a+b),300);
});
test('Cucurucho: quem está all-in apenas com ante participa do pote que cobriu',async()=>{
 let x=await start('texas',[100,1000,1000],100);
 for(let j=0;j<5 && !x.frame.finished;j++){
   const action=x.frame.legal.cucu!=null?{type:'cucuStay'}:{type:'fold'};
   x=await step({state:x.state,action});
 }
 assert.equal(x.frame.finished,true);
 assert.equal(x.frame.stacks.reduce((a,b)=>a+b),2100);
});
