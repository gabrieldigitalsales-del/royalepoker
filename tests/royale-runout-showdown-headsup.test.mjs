import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom, deal, move, handView} from '../server/game.mjs';
import {boardResults} from '../src/board-results.mjs';
import {showdownFlow} from '../src/showdown-flow.mjs';
import {stop} from '../server/worker.mjs';
after(stop);

async function simulatedShowdown(runCount, playerCount = 2) {
  const users = Array.from({length: playerCount}, (_, i) => ({id:`show_${i}`, name:`Jogador ${i+1}`,wallet:2000,preferences:{},diamonds:0}));
  const d={users:Object.fromEntries(users.map(p=>[p.id,p])),hands:{}};
  const r=makeRoom(users[0],{name:'Showdown test',game:'texas',capacity:6,blind:10,buy:50,seconds:30,timeBank:0});
  r.seats=users.map((p,i)=>({id:p.id,position:i,stack:200,bought:200,points:0}));
  r.button=users.at(-1).id;
  await deal(d,r);
  let steps=0, votes=0;
  while(r.hand && steps++<150) {
    const frame=r.hand.h.frames.at(-1);
    const l=frame.legal;
    const action=l.runout ? (votes++,{type:'runout',count:runCount}) : l.max!=null ? {type:'raise',amount:l.max} : 'call' in l ? {type:'pass'} : {type:'fold'};
    await move(d,r,r.hand.h.players[frame.actor].id,{rev:r.rev,action});
  }
  assert.equal(r.hand,null,'the hand must finish');
  assert.equal(votes,playerCount,'each eligible player votes for all-in runout');
  const h=d.hands[r.last], f=h.frames.at(-1);
  assert.equal(f.finished,true);
  assert.equal(f.boards.length,runCount,'every voted board must be created');
  assert.equal(f.stacks.reduce((a,b)=>a+b,0) + (f.rake ?? 0),playerCount*200,'the house rake and player stacks must conserve chips');
  assert.deepEqual([...new Set(f.awards.filter(a=>!a.uncontested).map(a=>a.boardIndex))].sort(),Array.from({length:runCount},(_,i)=>i),'the engine must settle EACH contested board');
  assert.ok(f.awards.every(a=>a.uncontested===false),'all-in showdown must not be marked uncontested');
  for (const award of f.awards) {
    assert.ok(award.winners.every(w=>w.cards.length===5 && w.label),'each run winner must have a named five-card hand');
  }
  for(const player of users) {
    const view=handView(h,player.id).frames[0];
    assert.ok(view.hole.every(cards=>cards.length===2 && cards.every(Boolean)),'all showdown opponents must see the eligible hole cards');
    const scores=boardResults(view.awards,h.players,runCount);
    assert.equal(scores.filter(score=>score.winners.length>0).length,runCount,'each player sees the scoreboard for every run');
    assert.equal(showdownFlow(view,0).resultsReady,false,'result waits until the runouts finish');
    const flow=showdownFlow(view,Infinity);
    assert.equal(flow.resultsReady,true);
    assert.ok(flow.awardAt>flow.runoutEnd);
    assert.equal(showdownFlow(view,flow.winnerAt).awardsReady,false,'winning hand displays before chips');
    assert.equal(showdownFlow(view,flow.awardAt-1).awardsReady,false,'do not award before the winner presentation ends');
    assert.equal(showdownFlow(view,flow.awardAt).awardsReady,true,'only award once all runs and winner display finish');
  }
  return {room:r,hand:h};
}
for(const n of [2,3]){
  test(`heads-up RUN ${n}: all cards revealed, ${n} scored boards, real paid winners`, async()=>{await simulatedShowdown(n,2)});
  test(`three players RUN ${n}: independent payouts, no missing results`, async()=>{await simulatedShowdown(n,3)});
}
