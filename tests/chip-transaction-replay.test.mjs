import test from 'node:test';
import assert from 'node:assert/strict';
import { chipTransactionKey, findChipTransactionReplay, recordChipTransaction } from '../server/chip-transaction-replay.mjs';
const ref = '1234567890abcdef1234567890abcdef';
test('comprovante impede duplicar a reposição no reenvio', () => {
 const events = {};
 assert.equal(findChipTransactionReplay(events,'a',ref,{room:'mesa',recipient:'b',amount:9950}),null);
 recordChipTransaction(events,'a',ref,{room:'mesa',recipient:'b',amount:9950,credited:9950,stack:10500});
 assert.deepEqual(findChipTransactionReplay(events,'a',ref,{room:'mesa',recipient:'b',amount:9950}),{credited:9950,stack:10500,pending:false});
 assert.equal(Object.keys(events).length,1);
 assert.throws(()=>recordChipTransaction(events,'a',ref,{room:'mesa',recipient:'b',amount:9950,credited:9950,stack:20450}), /já registrado/);
});
test('comprovante não pode ser reutilizado para outro valor ou destinatário', () => {
 const events={};recordChipTransaction(events,'a',ref,{room:'mesa',recipient:'b',amount:9950,credited:9950,stack:10500});
 for(const params of [{room:'mesa',recipient:'c',amount:9950},{room:'mesa',recipient:'b',amount:950},{room:'outra',recipient:'b',amount:9950}])
  assert.throws(()=>findChipTransactionReplay(events,'a',ref,params),/outro valor/);
});
test('comprovante valida créditos inteiros e seguros',()=>{
 assert.throws(()=>chipTransactionKey('a','bad'),/inválido/);
 assert.throws(()=>recordChipTransaction({},'a',ref,{room:'r',recipient:'b',amount:9950,credited:950,stack:10500}),/inválido/);
 assert.throws(()=>recordChipTransaction({},'a',ref,{room:'r',recipient:'b',amount:1.5,credited:1.5,stack:100}),/inválido/);
});
