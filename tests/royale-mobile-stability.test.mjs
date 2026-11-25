import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("mobile table keeps the entire stage inside a stable viewport without scrolling",()=>{
  const css=read("src/royale-mobile-stable-stage.css");
  const main=read("src/main.tsx");
  assert.match(css,/height:100svh!important/);
  assert.match(css,/touch-action:none!important/);
  assert.match(css,/overscroll-behavior:none!important/);
  assert.match(css,/\.studio \.studio-layout > \.console/);
  assert.match(css,/\.studio \.portrait-table \.portrait-seat/);
  assert.match(css,/transition-property:opacity,box-shadow,border-color,background-color!important/);
  assert.ok(main.lastIndexOf("royale-mobile-stable-stage.css")>main.lastIndexOf("royale-opponent-pocket-fan.css"));
});

test("mobile compact design preserves unscaled crisp cards and functional dialogs",()=>{
 const css=read("src/royale-mobile-stable-stage.css");
 assert.match(css,/min-width:29px!important/);
 assert.match(css,/min-height:42px!important/);
 assert.match(css,/\.modal-body/);
 assert.match(css,/touch-action:pan-y!important/);
 assert.doesNotMatch(css,/\.studio\s*\{[^}]*zoom:/);
 assert.doesNotMatch(css,/\.studio\s*\{[^}]*transform:scale/);
});
