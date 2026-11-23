import test from 'node:test';
import assert from 'node:assert/strict';
import { actionVoicePhrase } from '../src/action-voice.mjs';

test('narra call, check, fold, bet e raise depois de confirmados', () => {
  assert.equal(actionVoicePhrase({action:'pass', paid:40}), 'CALL');
  assert.equal(actionVoicePhrase({action:'pass', paid:0}), 'CHECK');
  assert.equal(actionVoicePhrase({action:'fold'}), 'FOLD');
  assert.equal(actionVoicePhrase({action:'raise',label:'Delex · Bet para 100'}), 'BET');
  assert.equal(actionVoicePhrase({action:'raise',label:'Delex · Raise para 200'}), 'RAISE');
});
test('votos ainda abertos não anunciam resultados provisórios', () => {
  assert.equal(actionVoicePhrase({action:'runout', runoutCount:3, legal:{runout:[1,2,3]}}), null);
});
test('anuncia 1, 2 ou 3 somente depois do encerramento da votação', () => {
  assert.equal(actionVoicePhrase({action:'runout',runoutCount:1,legal:{}}), 'É CÔCO');
  assert.equal(actionVoicePhrase({action:'runout',runoutCount:2,legal:{}}), 'VAMOS LÁ, BATER DUAS');
  assert.equal(actionVoicePhrase({action:'runout',runoutCount:3,legal:{}}), 'VAMOS LÁ, BATER 3');
});
