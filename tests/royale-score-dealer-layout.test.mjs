import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../src/',import.meta.url);
const ui=readFileSync(new URL('PortraitBoard.tsx',root),'utf8');
const table=readFileSync(new URL('Table.tsx',root),'utf8');
const css=readFileSync(new URL('poker-royale-board-system.css',root),'utf8');
const main=readFileSync(new URL('main.tsx',root),'utf8');
test('single authoritative last CSS owns scoreboard and dealer anchor',()=>{
 assert.match(main,/import "\.\/poker-royale-ux-finish\.css";[\s\S]*import "\.\/poker-royale-board-system\.css";/);
 assert.doesNotMatch(main,/poker-royale-run-score\.css/);
 assert.match(css,/royale-showdown-results\.royale-run-score/);
 assert.match(css,/dealer-choice-spot\.royale-dealer-pot-anchored/);
 assert.match(table,/dealer-choice-spot royale-dealer-pot-anchored/);
});
test('results display each run with a five-card mini score instead of table Card',()=>{
 assert.match(ui,/settledBoards\.map\(\(entry: any\)/);
 assert.match(ui,/combo\.length === 5/);
 assert.match(ui,/royale-run-score-five/);
 assert.match(css,/flex-direction:row!important;flex-wrap:nowrap!important/);
});
test('no fabricated prizes for runs which did not have award',()=>{
 assert.match(ui,/uncontestedFinish/);
 assert.match(ui,/Pote decidido sem disputa/);
 assert.match(ui,/Sem premiação registrada/);
});
