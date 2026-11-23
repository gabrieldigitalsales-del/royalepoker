import test from 'node:test';
import assert from 'node:assert/strict';
import {revealAt,revealDuration} from '../src/runout-reveal.mjs';
test('three boards reveal in order, one card per tick',()=>{
  const options={from:0,delay:650,step:530};
  assert.equal(revealAt({...options,runIndex:0,cardIndex:0,elapsed:649}),false);
  assert.equal(revealAt({...options,runIndex:0,cardIndex:0,elapsed:650}),true);
  assert.equal(revealAt({...options,runIndex:0,cardIndex:4,elapsed:650+4*530}),true);
  assert.equal(revealAt({...options,runIndex:1,cardIndex:0,elapsed:650+4*530}),false);
  assert.equal(revealAt({...options,runIndex:1,cardIndex:0,elapsed:650+5*530}),true);
  assert.equal(revealAt({...options,runIndex:2,cardIndex:0,elapsed:650+9*530}),false);
  assert.equal(revealAt({...options,runIndex:2,cardIndex:4,elapsed:650+14*530}),true);
  assert.equal(revealDuration({...options,runs:3}),650+14*530);
});
test('flop cards remain visible in all three runs',()=>{
  assert.equal(revealAt({runIndex:2,cardIndex:2,from:3,elapsed:0}),true);
  assert.equal(revealAt({runIndex:1,cardIndex:3,from:3,elapsed:650+530}),false);
  assert.equal(revealAt({runIndex:1,cardIndex:3,from:3,elapsed:650+2*530}),true);
});
