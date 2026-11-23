import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { step, stop } from '../server/worker.mjs';

after(stop);

test('motor mantém associação correta de respostas em chamadas concorrentes', async () => {
  const jobs = [10, 20, 30, 40].map(blind =>
    step({ game: 'texas', blind, stacks: [1000,1000,1000] })
  );
  const results = await Promise.all(jobs);
  for (let i = 0; i < results.length; i++) {
    assert.equal(results[i].frame.stacks.reduce((sum, n) => sum+n, 0) + results[i].frame.pot, 3000);
    assert.ok(results[i].frame.pot >= [10,20,30,40][i]);
  }
});

test('erro de ação não desvia resposta da solicitação seguinte', async () => {
  const state = await step({ game:'texas', blind:10, stacks:[1000,1000] });
  const bad = step({ state:state.state, action:{type:'acao-inexistente'} });
  const good = step({ game:'texas', blind:10, stacks:[1200,900] });
  await assert.rejects(bad);
  const valid = await good;
  assert.equal(valid.frame.stacks.reduce((sum,n)=>sum+n,0) + valid.frame.pot,2100);
});
