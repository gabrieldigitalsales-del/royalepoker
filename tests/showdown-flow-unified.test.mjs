import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {showdownFlow} from '../src/showdown-flow.mjs';

test('all-in once: hero and opponent appear before prize, no jumps in results',()=>{
 const f={finished:true,board:['As','Kd','2c','4d','9h'],awards:[{uncontested:false}]};
 assert.equal(showdownFlow(f,0).cardsVisible,false);
 assert.equal(showdownFlow(f,360).cardsVisible,true);
 assert.equal(showdownFlow(f,539).resultsReady,false);
 assert.equal(showdownFlow(f,540).resultsReady,true);
 assert.ok(showdownFlow(f,540).awardAt>540);
});
for (const count of [2,3]) test(`run ${count} waits until all boards fully revealed to award`,()=>{
 const f={finished:true,board:['As','Kd','2c','4d','9h'],boards:Array.from({length:count},()=>['As','Kd','2c','4d','9h']),runoutFrom:3,runoutDelay:650,runoutStep:530};
 const end=650+(count*2-1)*530;
 assert.equal(showdownFlow(f,end+539).resultsReady,false);
 assert.equal(showdownFlow(f,end+540).resultsReady,true);
 assert.ok(showdownFlow(f,end+540).awardAt>end+540);
 assert.equal(showdownFlow(f,360).cardsVisible,true);
});
test('fold or showdown: visual clock never discloses any card by itself',()=>{
 const source=readFileSync(new URL('../server/game.mjs',import.meta.url),'utf8');
 assert.match(source,/const contestedShowdown/);
 assert.match(source,/return volunteered \|\|/);
});
test('manual reveal server allows current live or latest hand review only',()=>{
 const source=readFileSync(new URL('../server/start.mjs',import.meta.url),'utf8');
 assert.match(source,/Date\.now\(\) < \(r\.reviewUntil \?\? 0\)/);
 assert.match(source,/check\(b\.handId === hand\.id/);
 const ui=readFileSync(new URL('../src/Table.tsx',import.meta.url),'utf8');
 assert.match(ui,/canSelectReveal/);
 assert.match(ui,/setRevealConfirmation/);
});
