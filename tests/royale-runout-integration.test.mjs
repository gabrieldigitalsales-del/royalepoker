import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,deal,move} from '../server/game.mjs';
import {stop} from '../server/worker.mjs';
after(stop);

async function finishCash(votes){
 const players=votes.map((_,i)=>({id:`royale${i}`,name:`Jogador ${i}`,wallet:1000,preferences:{},diamonds:0}));
 const d={users:Object.fromEntries(players.map(p=>[p.id,p])),hands:{}};
 const r=makeRoom(players[0],{name:'Royale all-in',game:'texas',capacity:6,blind:10,buy:50,seconds:30,timeBank:0});
 r.seats=players.map((p,i)=>({id:p.id,position:i,stack:200,bought:200,points:0}));
 r.button=players.at(-1).id;
 await deal(d,r);
 let count=0,confirmed=0;
 for(let guard=0;guard<150&&r.hand;guard++){
   const f=r.hand.h.frames.at(-1);
   const l=f.legal;
   let action;
   if(l.runout){action={type:'runout',count:votes[confirmed++]};}
   else if(l.max!=null){action={type:'raise',amount:l.max};}
   else if('call' in l){action={type:'pass'};}
   else if(l.fold){action={type:'fold'};}
   else throw new Error('No legal action: '+JSON.stringify(l));
   await move(d,r,r.hand.h.players[f.actor].id,{rev:r.rev,action});
   count++;
 }
 assert.ok(!r.hand,'mão deve ter terminado');
 assert.equal(confirmed,votes.length,'todos os votantes confirmaram');
 const frame=d.hands[r.last].frames.at(-1);
 assert.equal(frame.stacks.reduce((x,y)=>x+y,0), votes.length*200 - (frame.rake ?? 0), 'o total das pilhas deve descontar somente o rake global');
 return {frame,room:r,actions:count};
}
test('Poker Royale: all-in real 3/3/3 votes, runs three boards',async()=>{
 const {frame}=await finishCash([3,3,3]);
 assert.equal(frame.boards.length,3);
 const awardedBoards = new Set((frame.awards ?? []).map(award => award.boardIndex));
 if ((frame.awards ?? []).some(award => !award.uncontested)) {
   assert.deepEqual([...awardedBoards].sort(), [0,1,2], 'corridas disputadas devem registrar vencedor em cada bordo');
 } else {
   assert.deepEqual([...awardedBoards], [0], 'pote não disputado não deve criar premiações fictícias nos demais bordos');
 }
});
test('Poker Royale: all-in real 3/3/2 votes, runs one board',async()=>{
 const {frame}=await finishCash([3,3,2]);
 assert.equal(frame.boards.length,1);
});
