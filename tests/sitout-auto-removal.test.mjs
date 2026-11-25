import test from "node:test";
import assert from "node:assert/strict";
import {
  MISSED_HANDS_BEFORE_SITOUT, SITOUT_EVICTION_MS, recordSeatAction,
  setSeatAway, isExpiredSitoutSeat, backfillSitoutTimestamp,
} from "../server/sitout-policy.mjs";
import { leave } from "../server/game.mjs";

test("Exactly 3 distinct missed hands trigger automatic sit out; repeated timeouts in one hand count once", () => {
  const seat = { id:"a", stack:100 };
  assert.equal(MISSED_HANDS_BEFORE_SITOUT, 3);
  assert.equal(recordSeatAction(seat, {expired:true,handId:"hand-1",now:1000}),false);
  assert.equal(recordSeatAction(seat, {expired:true,handId:"hand-1",now:2000}),false);
  assert.equal(seat.timeouts,1);
  assert.equal(recordSeatAction(seat, {expired:true,handId:"hand-2",now:3000}),false);
  assert.equal(seat.away,undefined);
  assert.equal(recordSeatAction(seat, {expired:true,handId:"hand-3",now:4000}),true);
  assert.equal(seat.away,true);
  assert.equal(seat.awaySince,4000);
  assert.equal(seat.timeouts,3);
});

test("Normal player action clears consecutive missed hands, manual sit out starts clock, returning cancels eviction", () => {
  const seat = { id:"a",stack:70 };
  recordSeatAction(seat,{expired:true,handId:"h1",now:100});
  recordSeatAction(seat,{expired:true,handId:"h2",now:200});
  recordSeatAction(seat,{expired:false,handId:"h2",now:210});
  assert.equal(seat.timeouts,0);
  recordSeatAction(seat,{expired:true,handId:"h3",now:300});
  assert.equal(seat.timeouts,1);
  setSeatAway(seat,true,500);
  assert.equal(seat.awaySince,500);
  assert.equal(isExpiredSitoutSeat(seat,500+SITOUT_EVICTION_MS-1),false);
  assert.equal(isExpiredSitoutSeat(seat,500+SITOUT_EVICTION_MS),true);
  setSeatAway(seat,false,500+SITOUT_EVICTION_MS-1);
  assert.equal(seat.away,false);
  assert.equal(seat.awaySince,undefined);
  assert.equal(seat.timeouts,0);
  assert.equal(isExpiredSitoutSeat(seat,Number.MAX_SAFE_INTEGER),false);
});

test("Legacy seated sit-out gets a fresh three-minute grace period after deployment",()=>{
  const seat={id:"a",away:true,stack:130};
  assert.equal(backfillSitoutTimestamp(seat,1000),true);
  assert.equal(seat.awaySince,1000);
  assert.equal(backfillSitoutTimestamp(seat,2000),false);
  assert.equal(seat.awaySince,1000);
  assert.equal(isExpiredSitoutSeat(seat,1000+SITOUT_EVICTION_MS-1),false);
  assert.equal(isExpiredSitoutSeat(seat,1000+SITOUT_EVICTION_MS),true);
});

test("Cash-out follows normal leave path, returns ALL stack and opens seat for next player",()=>{
  const user={id:"a",name:"Jogador A",wallet:300};
  const other={id:"b",name:"Jogador B",wallet:100};
  const room={id:"room-1",name:"Mesa",owner:"a",hand:null,tour:null,
    seats:[{id:"a",stack:250,bought:200,away:true,awaySince:100},{id:"b",stack:70,bought:70}],
    waitlist:[],cohosts:[],cashLedger:[],last:null};
  const data={users:{a:user,b:other},hands:{}};
  assert.equal(isExpiredSitoutSeat(room.seats[0],100+SITOUT_EVICTION_MS),true);
  leave(data,user,room);
  assert.equal(user.wallet,550);
  assert.equal(room.seats.length,1);
  assert.equal(room.seats[0].id,"b");
  assert.equal(room.owner,"b");
  assert.equal(room.cashLedger[0].cashedOut,250);
  assert.equal(room.cashLedger[0].bought,200);
});
