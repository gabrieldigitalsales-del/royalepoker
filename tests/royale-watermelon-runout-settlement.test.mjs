import test, { after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, deal, move, roomView, automatic } from "../server/game.mjs";
import { showdownFlow } from "../src/showdown-flow.mjs";
import { stop } from "../server/worker.mjs";
after(stop);

async function playWatermelonRun(count) {
  const users = [0,1].map(i=>({id:"wm"+i,name:"Watermelon "+i,wallet:2000,preferences:{},diamonds:0}));
  const d = {users:Object.fromEntries(users.map(u=>[u.id,u])),hands:{},cashier:{}};
  const r = makeRoom(users[0],{name:"Watermelon runout",game:"watermelon",capacity:2,blind:10,buy:100,seconds:30,timeBank:0});
  r.seats=users.map((u,i)=>({id:u.id,position:i,stack:120,bought:120,points:0}));
  r.button=users[1].id;
  await deal(d,r);
  let votes=0,steps=0;
  while(r.hand && steps++<140) {
    const f=r.hand.h.frames.at(-1), l=f.legal;
    let action;
    if(Array.isArray(l.runout)){action={type:"runout",count};votes++;}
    else if(l.required || "draw" in l || l.place) action=automatic(f);
    else if(l.max!=null) action={type:"raise",amount:l.max};
    else if("call" in l) action={type:"pass"};
    else if(l.fold) action={type:"fold"};
    else throw Error("No legal action: "+JSON.stringify(l));
    await move(d,r,r.hand.h.players[f.actor].id,{rev:r.rev,action});
  }
  assert.equal(r.hand,null,"watermelon must finish");
  const h=d.hands[r.last], f=h.frames.at(-1);
  assert.equal(f.finished,true);
  assert.equal(f.boards?.length,count);
  assert.equal(f.runoutFrom,0,"preflop all-in should reveal from empty board");
  assert.equal(f.stacks.reduce((sum,n)=>sum+n,0)+(f.rake??0),240);
  assert.ok(votes===2,"both players must choose run count");
  assert.ok(f.awards.every(a=>a.winners?.every(w=>w.cards?.length===5 && w.label)));
  // Before the visual award moment, the room view must not disclose credited stacks.
  const early=roomView(d,r,users[0],true);
  const releaseAt=h.ended+showdownFlow(f,0).awardAt;
  assert.ok(Date.now()<releaseAt);
  assert.equal(early.history.some(x=>x.id===h.id),false,"the final cash result must not be announced in history early");
  assert.deepEqual(early.lastHand.frames.at(-1).stacks,
    f.stacks.map((stack,i)=>Math.max(0,stack-(f.payouts[i]??0))));
  for(let i=0;i<2;i++) assert.equal(early.seats.find(s=>s.id===users[i].id).stack,
    f.stacks[i]-f.payouts[i]);
  return {f,r,h};
}
for(const count of [2,3]) test("Watermelon preflop all-in Run It "+count+" delays final credit until all boards are shown",
  async()=>await playWatermelonRun(count));
