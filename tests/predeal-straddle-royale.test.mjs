import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUtg, prepareUtgStraddle } from '../server/game.mjs';

const make = () => ({
  seats:['a','b','c','d'].map((id,position)=>({id,position,away:false,stack:200})),
  blind:20, button:'a', straddleEnabled:true, count:5,
});
test('a window opens only for upcoming UTG and remains stable within a hand',()=>{
  const r=make();
  assert.equal(nextUtg(r)?.id,'a');
  assert.equal(prepareUtgStraddle(r,5000),true);
  assert.deepEqual(r.preStraddle,{playerId:'a',handCount:5,expiresAt:12000});
  assert.equal(prepareUtgStraddle(r,7000),true);
  assert.equal(r.preStraddle.expiresAt,12000);
  r.preStraddleHandledFor=5;
  assert.equal(prepareUtgStraddle(r,7000),false);
});
test('heads-up, disabled straddle and insufficient UTG balance open no window',()=>{
  const r=make();r.seats[2].away=true;r.seats[3].away=true;
  assert.equal(prepareUtgStraddle(r,1000),false);
  assert.equal(r.preStraddle,undefined);
  const s=make(); s.seats[0].stack=30;
  assert.equal(prepareUtgStraddle(s,1000),false);
  assert.equal(s.preStraddleHandledFor,5);
  const t=make(); t.straddleEnabled=false;
  assert.equal(prepareUtgStraddle(t,1000),false);
});
