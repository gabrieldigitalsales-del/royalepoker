import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {step,stop} from '../server/worker.mjs';
import {viewFrame} from '../server/game.mjs';
after(stop);
const base={game:'texas',blind:20,stacks:[1000,1000],cucurucho:true,cucuruchoAnte:50,runout:false};

test('Cucurucho: dois participantes que ficam chegam ao showdown com mão vencedora formada',async()=>{
 let x=await step(base);
 assert.equal(x.frame.board.length,3);
 for(let i=0;i<2;i++){
   assert.equal(x.frame.legal.cucu,100);
   x=await step({state:x.state,action:{type:'cucuStay'}});
 }
 assert.equal(x.frame.finished,true);
 assert.equal(x.frame.board.length,5);
 assert.deepEqual(x.frame.public.map((cards)=>cards.every(Boolean)),[true,true]);
 assert.ok(x.frame.awards.length);
 assert.ok(x.frame.awards.every((a)=>a.uncontested===false),'a showdown should be contested');
 assert.ok(x.frame.awards.every((a)=>a.winners.every((w)=>w.cards.length===5 && !!w.label)));
 assert.equal(x.frame.stacks.reduce((a,b)=>a+b),2000);
 const h={players:[{id:'p1'},{id:'p2'}],showCards:{}};
 const playerView=viewFrame(h,x.frame,'p1');
 assert.ok(playerView.hole[1].every(Boolean),'opponent cards must be visible at showdown');
 assert.ok(playerView.awards[0].winners.every(w=>w.cards.length===5));
});

test('Cucurucho: jogador que desiste não provoca showdown nem revela a mão do vencedor',async()=>{
 let x=await step(base);
 x=await step({state:x.state,action:{type:'fold'}});
 assert.equal(x.frame.finished,true);
 assert.ok(x.frame.awards.every(a=>a.uncontested));
 const h={players:[{id:'p1'},{id:'p2'}],showCards:{}};
 const other=viewFrame(h,x.frame,'p1');
 assert.ok(other.hole[1].every(card=>card===null));
});

test('Cucurucho: Omaha 4, 5, 6 e 7 deve identificar cinco cartas vencedoras no showdown',async()=>{
 for(const game of ['om4','om5','om6','om7']){
   let x=await step({...base,game});
   while(!x.frame.finished) x=await step({state:x.state,action:{type:'cucuStay'}});
   assert.ok(x.frame.awards.every(a=>!a.uncontested),`${game} contested`);
   assert.ok(x.frame.hole.every(cards=>cards.length===Number(game.slice(2))),`${game} all stayers reveal their cards`);
   assert.ok(x.frame.public.every(cards=>cards.length===Number(game.slice(2)) && cards.every(Boolean)),`${game} all participants public`);
   assert.ok(x.frame.awards.every(a=>a.winners.every(w=>w.cards.length===5)),`${game} best five`);
 }
});

test('Avatar online: photo renders without placeholder; frontend points to configured backend',()=>{
 const face=readFileSync(new URL('../src/PlayerIdentity.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/poker-royale-photo-fix.css',import.meta.url),'utf8');
 const api=readFileSync(new URL('../src/api.ts',import.meta.url),'utf8');
 assert.match(face,/player-face--photo/);
 assert.match(face,/onError=\{\(\) => setBrokenPhoto/);
 assert.match(css,/background:transparent!important/);
 assert.match(api,/VITE_SERVER_URL/);
});
