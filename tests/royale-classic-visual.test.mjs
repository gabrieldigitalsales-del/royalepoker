import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Royale Classic is real game surface, not a static mockup",()=>{
 const table=get("src/Table.tsx");
 const main=get("src/main.tsx");
 const css=get("src/royale-classic-game.css");
 assert.match(table,/data-royale-visual=\{royaleVisual\}/);
 assert.match(table,/setRoyaleVisual\(next\)/);
 assert.match(table,/poker-royale-visual-mode/);
 assert.match(table,/<option value="classic">Royale Classic/);
 assert.match(table,/<option value="current">Royale Atual/);
 assert.match(table,/<option value="focus">Royale Focus/);
 assert.match(table,/\? saved! : "classic"/);
 assert.match(css,/\.studio\[data-royale-visual="classic"\]/);
 assert.match(css,/\.portrait-seat\.acting/);
 assert.match(css,/\.console \.player-hand/);
 assert.match(css,/\.portrait-table \.table-rail/);
 assert.ok(existsSync(new URL("../public/royale-classic-chamber.svg",import.meta.url)));
 assert.ok(main.lastIndexOf("royale-classic-game.css")>main.lastIndexOf("royale-flat-reference-cards.css"));
});
test("Classic only styles scene; new visual mode does not alter cards/engine",()=>{
 const css=get("src/royale-classic-game.css");
 assert.doesNotMatch(css,/data-royale-card="face"\][^{]*display:none/);
 assert.doesNotMatch(css,/\.royal-reveal-card[^\n]*\{[^}]*filter:blur/);
 assert.match(css,/data-royale-visual="focus"/);
 assert.match(css,/data-royale-visual="current"/);
});
