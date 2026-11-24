import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Poker Royale card face has clear rank, four suits and accessible card labels",()=>{
 const ui=read("../src/ui.tsx");
 const css=read("../src/royale-premium-cards.css");
 assert.match(ui,/\["royale", "Royal Premium/);
 assert.match(ui,/data-rank=\{value \|\| undefined\}/);
 assert.match(ui,/data-royale-card=\{c \? "face" : "back"\}/);
 for(const suit of ["s","h","d","c"])assert.match(css,new RegExp('data-suit="'+suit+'"'));
 assert.match(css,/data-royale-card="face"/);
 assert.match(css,/card-emblem/);
});
test("Every visible card has exactly one suit marker, including compact mobile boards",()=>{
 const ui=read("../src/ui.tsx");
 const css=read("../src/royale-premium-cards.css");
 const face=ui.slice(ui.indexOf('{c ? ('),ui.indexOf(') : (',ui.indexOf('{c ? (')));
 assert.match(face,/<span className="card-emblem"/);
 assert.doesNotMatch(face,/<i>\{suits\[c\[1\]\]\}<\/i>/);
 assert.match(css,/royale-multiple-boards[\s\S]*?\.card-emblem/);
 assert.doesNotMatch(css,/\.card\[data-royale-card="face"\] \.card-emblem\s*\{\s*display:none!important/);
});
test("Unified card design shares existing table dimensions, includes history, winner and flip effects",()=>{
 const css=read("../src/royale-premium-cards.css");
 const board=read("../src/royale-double-board-final.css");
 const show=read("../src/royale-showdown-ceremony.css");
 const imports=read("../src/main.tsx");
 assert.match(imports,/import "\.\/royale-premium-cards\.css";/);
 assert.match(css,/royale-history-winning-card/);
 assert.match(css,/royale-showdown-best-card/);
 assert.match(css,/royale-card-back\.svg/);
 assert.match(show,/royale-ceremony-card-land/);
 assert.match(board,/royale-multiple-boards/);
 assert.doesNotMatch(css,/\.portrait-board\s*\{\s*(?:width|height|top):/);
});
test("Public card preferences offer premium option without removing legacy user choices",()=>{
 const ui=read("../src/ui.tsx");
 const table=read("../src/Table.tsx");
 for(const mode of ["vivid","ivory","classic","night","royale"])
   assert.ok(ui.includes('["'+mode+'",'),"Missing visual preference "+mode);
 assert.match(table,/cards: "royale", name: "Arena Royale"/);
 assert.match(ui,/localStorage\.getItem\("mesa-card-style"\) \?\? "royale"/);
});
test("Royal card back is original vector with wine and gold, not loaded from remote sources",()=>{
 const art=read("../public/royale-card-back.svg");
 assert.match(art,/viewBox="0 0 320 448"/);
 assert.match(art,/#63263c/);
 assert.match(art,/ROYALE/);
 assert.doesNotMatch(art,/<image\b|href="https?:/);
});
