import test from 'node:test';
import assert from 'node:assert/strict';
import {previewFee,prototypeLedger} from '../server/rake-prototype.mjs';
test('projeção percorre 3 a 7 por cento sem alterar valores',()=>{
 const pot=9950, rates=new Set();
 for(const hand of ['a','b','c','d','e']) {
   const row=previewFee(pot,hand);
   rates.add(row.ratePercent);
   assert.equal(row.projectedFee,Math.floor(pot*row.ratePercent/100));
   assert.equal(row.simulation,true);
 }
 assert.deepEqual([...rates].sort(),[3,4,5,6,7]);
 assert.equal(pot,9950);
});
test('resumo administrativo soma somente as simulações',()=>{
 const room={adminFeePreview:[{projectedFee:30},{projectedFee:70}]};
 assert.deepEqual(prototypeLedger(room),{simulation:true,totalProjected:100,hands:room.adminFeePreview});
});
