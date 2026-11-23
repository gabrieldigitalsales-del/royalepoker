import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src = (name) => readFileSync(new URL('../src/'+name, import.meta.url), 'utf8');
test('Replay has previous street and chronological action strip', () => {
 const s=src('Table.tsx'); assert.match(s,/Rodada anterior/); assert.match(s,/royale-replay-action-strip/);
});
test('VIP 3-bet and per-player history comparison use recorded fields',()=>{
 const s=src('Table.tsx'); assert.match(s,/vipStats.three/); assert.match(s,/participant.invested/); assert.match(s,/participant.received/);
});
test('Showdown differentiates tied pots and sole winners',()=>{
 const s=src('PortraitBoard.tsx'); assert.match(s,/entry\.tied\s*\?\s*[\"']🤝[\"']\s*:\s*[\"']👑[\"']/); assert.match(s,/boardWinningCards/);
});
test('Mobile styling and result ranking are present',()=>{
 assert.match(src('poker-royale-ux-finish.css'), /@media/);
 assert.match(src('TableClosingSummary.tsx'), /ranking/);
});
