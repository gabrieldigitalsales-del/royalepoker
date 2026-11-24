import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fanGeometry, fanCardStyle } from "../src/card-fan.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Fans adapt from 2 to 7 hole cards without hiding left-edge rank/suit",()=>{
  for (const kind of ["hero","opponent"]) {
    let previous = 0;
    for(let count=2; count<=7; count++){
      const { overlap, angleStep }=fanGeometry(count,kind);
      assert.ok(overlap >= previous,"overlap grows with card count");
      assert.ok(overlap <= (kind==="hero"?12:17),"overlap capped to protect rank and suit");
      assert.ok(angleStep > 0 && angleStep<=7);
      const first = fanCardStyle(count,0,kind);
      const last = fanCardStyle(count,count-1,kind);
      assert.equal(first["--fan-overlap"], overlap+"px");
      assert.equal(last["--fan-overlap"], overlap+"px");
      assert.equal(parseFloat(first["--fan-rotation"]),-parseFloat(last["--fan-rotation"]));
      previous=overlap;
    }
  }
});

test("Live opponents, triple-run hero and face-up pockets receive adaptive fan geometry",()=>{
  const table=read("../src/PortraitBoard.tsx");
  const css=read("../src/royale-adaptive-fans.css");
  assert.match(table,/import \{ fanCardStyle, fanGeometry \} from "\.\/card-fan\.mjs"/);
  assert.match(table,/fanCardStyle\(cards\.length, j\)/);
  assert.match(table,/fanCardStyle\(heroCards\.length, j, "hero"\)/);
  assert.match(table,/fanGeometry\(cards\.length\)\.overlap/);
  assert.match(table,/--fan-step/);
  assert.match(css,/margin-left:calc\(-1 \* var\(--fan-overlap/);
  assert.match(css,/\.pocket\.faceup > span/);
  assert.match(css,/--fan-step/);
});

test("Showdown highlights only cards in authoritative five-card best combination",()=>{
  const table=read("../src/PortraitBoard.tsx");
  assert.match(table,/comboCardsForWinner\(winner\)\.includes\(card\)/);
  assert.match(table,/winner\.bestCards\?\.length === 5/);
  assert.match(table,/combo\.length === 5/);
  const css=read("../src/royale-adaptive-fans.css");
  assert.match(css,/royale-showdown-best-card/);
  assert.match(css,/border-color:#f9d483!important/);
});

test("Portrait, Double Board and 3-run cards keep readable ranks and single suit on mobile",()=>{
  const deck=read("../src/ui.tsx");
  const css=read("../src/royale-adaptive-fans.css");
  const main=read("../src/main.tsx");
  const boards=read("../src/royale-double-board-final.css");
  assert.equal((deck.slice(deck.indexOf("{c ? ("),deck.indexOf(") : (",deck.indexOf("{c ? ("))).match(/card-emblem/g)||[]).length,1);
  assert.match(css,/\.studio \.console \.player-hand/);
  assert.match(css,/flex-wrap:nowrap!important/);
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(boards,/royale-multiple-boards/);
  assert.ok(main.lastIndexOf("royale-adaptive-fans.css") > main.lastIndexOf("royale-premium-cards.css"));
});
