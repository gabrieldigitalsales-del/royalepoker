import test, {after} from 'node:test';
import {stop} from '../server/worker.mjs';
after(stop);
import assert from 'node:assert/strict';
import {makeRoom, sit, leave} from '../server/game.mjs';

test('buy-in de 9.950 credita exatamente 9.950 e debita a mesma quantia',()=>{
  const owner={id:'owner',name:'Owner',wallet:50000};
  const player={id:'p',name:'Delex',wallet:20000};
  const d={users:{owner, p:player}};
  const room=makeRoom(owner,{name:'Teste exato',game:'texas',capacity:6,blind:20,buy:1000,seconds:25});
  sit(d,player,room,{position:0,amount:9950});
  assert.equal(player.wallet,10050);
  assert.equal(room.seats[0].stack,9950);
  assert.equal(room.seats[0].bought,9950);
  assert.equal(room.seats[0].funding[0].amount,9950);
  assert.equal(player.wallet+room.seats[0].stack,20000);
  assert.throws(()=>sit(d,player,room,{position:1,amount:9950}),/já está/);
  leave(d,player,room);
  assert.equal(player.wallet,20000);
  assert.equal(room.cashLedger[0].bought,9950);
  assert.equal(room.cashLedger[0].cashedOut,9950);
});
test('entrada rejeitada não altera carteira nem assentos',()=>{
 const user={id:'a',name:'A',wallet:2000};
 const r=makeRoom(user,{name:'Teste',game:'texas',capacity:6,blind:20,buy:1000,seconds:25});
 assert.throws(()=>sit({users:{a:user}},user,r,{position:0,amount:9950}),/Saldo insuficiente/);
 assert.equal(user.wallet,2000);
 assert.equal(r.seats.length,0);
});
