import test, { after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, deal, move, roomView, automatic } from "../server/game.mjs";
import { showdownFlow } from "../src/showdown-flow.mjs";
import { revealAt } from "../src/runout-reveal.mjs";
import { stop } from "../server/worker.mjs";

after(stop);

async function play(game, runs) {
  const users = [0, 1].map(i => ({ id: game+i, name: game+i,
    wallet:2000,diamonds:0,preferences:{} }));
  const d = { users:Object.fromEntries(users.map(u=>[u.id,u])), hands:{},cashier:{} };
  const r = makeRoom(users[0], {name:game,game,capacity:2,blind:10,buy:100,seconds:30,timeBank:0});
  r.seats=users.map((u,i)=>({id:u.id,position:i,stack:140,bought:140,points:0}));
  r.button=users[1].id;
  await deal(d,r);
  let votes=0;
  let discarded=0;
  for(let n=0;r.hand && n<180;n++){
    const frame=r.hand.h.frames.at(-1), l=frame.legal;
    let action;
    if(Array.isArray(l.runout)){
      assert.ok(l.runout.includes(runs),game+" should permit "+runs+" runouts");
      action={type:"runout",count:runs}; votes++;
    } else if(l.required || "draw" in l || l.place) {
      action=automatic(frame);discarded++;
    } else if(l.max!=null) {
      action={type:"raise",amount:l.max};
    } else if("call" in l){
      action={type:"pass"};
    } else if(l.fold) {
      action={type:"fold"};
    } else throw Error(game+" has no legal action: "+JSON.stringify(l));
    await move(d,r,r.hand.h.players[frame.actor].id,{rev:r.rev,action});
  }
  assert.equal(r.hand,null,game+" must finish");
  const h=d.hands[r.last],f=h.frames.at(-1);
  assert.equal(f.finished,true);
  assert.equal(f.boards.length,runs);
  assert.equal(f.board.length,5);
  assert.equal(f.stacks.reduce((a,b)=>a+b,0)+(f.rake??0),280);
  if(runs>1 && !game.endsWith("db")) assert.equal(votes,2,game+" both players vote");
  if(["watermelon","pine","crazy"].includes(game)) assert.ok(discarded>0,game+" completes mandatory discard first");
  assert.ok(Number.isInteger(f.runoutFrom) && f.runoutFrom<5,game+" needs timing anchor");
  const flow=showdownFlow(f,0);
  const lastCard=5-1;
  const lastRevealIndex=runs-1;
  assert.equal(revealAt({runIndex:lastRevealIndex,cardIndex:lastCard,from:f.runoutFrom,
    elapsed:flow.lastCardAt-1,delay:f.runoutDelay,step:f.runoutStep}),false);
  assert.equal(revealAt({runIndex:lastRevealIndex,cardIndex:lastCard,from:f.runoutFrom,
    elapsed:flow.lastCardAt,delay:f.runoutDelay,step:f.runoutStep}),true);
  assert.equal(showdownFlow(f,flow.lastCardAt).awardsReady,false);
  assert.equal(showdownFlow(f,flow.winnerAt).awardsReady,false);
  assert.equal(showdownFlow(f,flow.awardAt-1).awardsReady,false);
  assert.equal(showdownFlow(f,flow.awardAt).awardsReady,true);
  const view=roomView(d,r,users[0],true);
  assert.equal(view.history.some(x=>x.id===h.id),false);
  assert.ok(Math.abs(view.serverTime-Date.now())<1500);
  h.players.forEach((player,i)=>{
    const seat=view.seats.find(x=>x.id===player.id);
    assert.equal(seat.stack, f.stacks[i]-f.payouts[i],game+" must hide prize in public balance");
  });
  assert.ok(r.reviewUntil>=h.ended+flow.awardAt+3000,
    "next hand cannot start before winner celebration");
}
for(const game of ["om5db","om6db"]) test(game+" Double Board all-in: two boards finish before chips",async()=>play(game,2));
for(const game of ["pine","crazy","watermelon"])
  for(const runs of [2,3])
    test(game+" discard mode: "+runs+" runs finish before prize",async()=>play(game,runs));
