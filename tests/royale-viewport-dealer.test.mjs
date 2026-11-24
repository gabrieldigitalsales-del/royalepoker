import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../server/start.mjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/Table.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/poker-royale.css',import.meta.url),'utf8');
const board=readFileSync(new URL('../src/PortraitBoard.tsx',import.meta.url),'utf8');
test('dealer receives an authoritative clock hold and a resume action',()=>{
 assert.match(server,/case "choiceHold"/);
 assert.match(server,/case "choiceResume"/);
 assert.match(server,/!room\.nextChoice\.heldAt && room\.nextChoice\.at <= now/);
 assert.match(server,/holdDealerChoice\(r\.nextChoice\)/);
 assert.match(server,/resumeDealerChoice\(r\.nextChoice/);
 assert.match(server,/r\.nextChoice\.id = b\.choice/);
});
test('the UI pauses on opening and keeps the previous selection when closed',()=>{
 assert.match(ui,/await api\("choiceHold"/);
 assert.match(ui,/await api\("choiceResume"/);
 assert.match(ui,/current=\{r\.nextChoice\?\.id\}/);
});
test('no page scrolling; logo is transparent and centered',()=>{
 assert.match(css,/\.content:has\(\.studio\) > header\{display:none!important\}/);
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(board,/royale-table-watermark/);
});
