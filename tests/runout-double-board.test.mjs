import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {step,stop} from '../server/worker.mjs';
import {makeRoom} from '../server/game.mjs';
after(stop);
async function progress({game='texas',choices=[3,3],stacks=[100,100],blind=20,stopStreet=null}={}){
 let x=await step({game,stacks,blind,runout:true});
 let i=0,votes=0;
 for(let guard=0;guard<120 && !x.frame.finished;guard++){
  const f=x.frame, l=f.legal;
  const action=l.runout?{type:'runout',count:choices[votes++]}:
   l.max!=null?{type:'raise',amount:l.max}:
   'call' in l?{type:'pass'}:
   l.fold?{type:'fold'}:null;
  assert.ok(action,'Expected a legal move');
  x=await step({state:x.state,action});i++;
 }
 assert.ok(x.frame.finished,'Hand should finish');
 return {frame:x.frame,votes};
}
test('2 votos em 3 criam 3 bordos sem emitir fichas',async()=>{
 const {frame,votes}=await progress();
 assert.equal(votes,2);assert.equal(frame.runoutCount,3);assert.equal(frame.boards.length,3);
 for(const b of frame.boards) assert.equal(b.length,5);
 assert.equal(frame.stacks.reduce((a,b)=>a+b),200);
});
test('Votos diferentes geram só um bordo',async()=>{
 const {frame}=await progress({choices:[3,2]});
 assert.equal(frame.runoutCount,1);assert.equal(frame.boards.length,1);
});
test('3 all-ins com votos 3,3,2 fazem côco, com potes conservados',async()=>{
 const {frame,votes}=await progress({choices:[3,3,2],stacks:[30,70,120],blind:10});
 assert.equal(votes,3);assert.equal(frame.boards.length,1);
 assert.equal(frame.stacks.reduce((a,b)=>a+b),220);
 assert.equal(frame.potDetails[0].amount,90);
});
test('Double Board 5 e 6 recebem 2 bordos e preservam stacks',async()=>{
 for(const game of ['om5db','om6db']){
  let x=await step({game,stacks:[100,100],blind:10});
  assert.equal(x.frame.hole[0].length,Number(game[2]));
  for(let i=0;i<30&&!x.frame.finished;i++){
   const l=x.frame.legal;
   x=await step({state:x.state,action:{type:'pass'}});
  }
  assert.ok(x.frame.finished);
  assert.equal(x.frame.boards.length,2);
  assert.deepEqual(x.frame.boards.map(x=>x.length),[5,5]);
  assert.equal(x.frame.stacks.reduce((a,b)=>a+b),200);
 }
});
test('Salas novas têm votação de corridas ativada por padrão e straddle opt-in',()=>{
 const game=makeRoom({id:'owner'}, {game:'texas',name:'Mesa Teste',capacity:5,blind:10,buy:100,seconds:25,timeBank:0});
 assert.equal(game.runoutEnabled,true);
 assert.equal(game.straddleEnabled,true);
});
