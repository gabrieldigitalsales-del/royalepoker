import test from 'node:test';
import assert from 'node:assert/strict';
import { closingSummary } from '../server/closing-summary.mjs';
test('encerramento inclui jogadores que saíram e voltaram sem duplicar o saldo',()=>{
 const room={id:'mesa',name:'Poker Royale',buy:1000,cashLedger:[{id:'a',name:'Alice',bought:1000,cashedOut:1400},{id:'b',name:'Bruno',bought:500,cashedOut:250}],seats:[{id:'a',bought:1000,stack:1150},{id:'c',bought:200,stack:100}]};
 const users={a:{name:'Alice',avatar:'👑'},b:{name:'Bruno',avatar:'🐺'},c:{name:'Caio',avatar:'♠'}};
 const result=closingSummary(room,users,u=>u.avatar);
 assert.equal(result.players.length,3);
 assert.deepEqual(Object.fromEntries(result.players.map(p=>[p.id,p.net])),{a:550,c:-100,b:-250});
 assert.equal(result.totalBuyins,2700);
 assert.equal(result.totalCashouts,2900);
 assert.equal(result.net,200);
 assert.equal(result.players[0].avatar,'👑');
});
test('resumo com resultado equilibrado',()=>{
 const result=closingSummary({cashLedger:[],seats:[{id:'a',bought:1000,stack:1550},{id:'b',bought:1000,stack:450}]},{a:{name:'A'},b:{name:'B'}});
 assert.deepEqual(result.players.map(p=>p.net),[550,-550]);
 assert.equal(result.net,0);
});
