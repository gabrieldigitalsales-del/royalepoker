import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {step,stop} from '../server/worker.mjs';
after(stop);
async function firstVote(game,number){
 let x=await step({game,blind:10,stacks:Array(number).fill(200),runout:true});
 for(let turn=0;turn<150 && !x.frame.finished;turn++){
  const legal=x.frame.legal;
  if(legal.runout) return {x,options:legal.runout};
  const action=legal.max!=null?{type:'raise',amount:legal.max}:'call' in legal?{type:'pass'}:legal.fold?{type:'fold'}:null;
  assert.ok(action,'No legal decision');
  x=await step({state:x.state,action});
 }
 assert.fail('No all-in vote');
}
test('Omaha 6 com seis jogadores bloqueia 3× por falta de cartas',async()=>{
 const {x,options}=await firstVote('om6',6);
 assert.deepEqual(options,[1,2]);
 await assert.rejects(step({state:x.state,action:{type:'runout',count:3}}),/Baralho insuficiente/);
});
test('Texas com dez jogadores permite três corridas quando o baralho comporta',async()=>{
 const {options}=await firstVote('texas',10);
 assert.deepEqual(options,[1,2,3]);
});
test('Double Board Omaha 6 com seis jogadores distribui dois bordos completos e conserva fichas',async()=>{
 let x=await step({game:'om6db',blind:10,stacks:Array(6).fill(200)});
 for(let turn=0;turn<150&&!x.frame.finished;turn++){
  const l=x.frame.legal;
  const action=l.max!=null?{type:'raise',amount:l.max}:'call' in l?{type:'pass'}:l.fold?{type:'fold'}:null;
  assert.ok(action);
  x=await step({state:x.state,action});
 }
 assert.equal(x.frame.finished,true);
 assert.deepEqual(x.frame.boards.map(board=>board.length),[5,5]);
 assert.equal(x.frame.stacks.reduce((a,b)=>a+b,0),1200);
 const contest=x.frame.awards.filter(a=>!a.uncontested);
 assert.ok(contest.some(a=>a.boardIndex===0));
 assert.ok(contest.some(a=>a.boardIndex===1));
});
