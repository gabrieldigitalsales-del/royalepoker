import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const table=readFileSync(new URL('../src/Table.tsx', import.meta.url),'utf8');
const board=readFileSync(new URL('../src/PortraitBoard.tsx', import.meta.url),'utf8');
const css=readFileSync(new URL('../src/poker-royale-board-system.css', import.meta.url),'utf8');
test('Run It 2 and Run It 3 share the same compact hero fan',()=>{
 assert.match(table,/f\?\.runoutCount >= 2 && f\?\.boards\?\.length >= 2/);
 assert.match(board,/finalRunout >= 2 && \(f\?\.boards\?\.length \?\? 0\) >= 2/);
 assert.match(board,/royale-triple-hero-cards/);
 assert.match(css,/\.studio\.royale-triple-run-active \.studio-layout > \.console > \.player-hand/);
});
