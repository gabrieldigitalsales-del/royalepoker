import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEALER_CHOICE_MS, DEALER_REVIEW_MS, DEALER_PAUSE_MS,
  prepareDealerChoice, holdDealerChoice, resumeDealerChoice, choiceTimeLeft,
} from "../server/dealer-seat-sync.mjs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

test("Dealer Choice: nine-second analysis precedes exactly five-second selection", () => {
  assert.equal(DEALER_REVIEW_MS,9000);
  assert.equal(DEALER_CHOICE_MS,5000);
  const room={game:"choice",seats:[{id:"a",stack:100},{id:"b",stack:100}],button:"a",rotation:["texas"]};
  assert.equal(prepareDealerChoice(room,{texas:{max:10}},50000),true);
  assert.equal(room.nextChoice.openedAt,50000);
  assert.equal(room.nextChoice.at,55000);
  assert.equal(choiceTimeLeft(room.nextChoice,49000),5000);
  assert.equal(choiceTimeLeft(room.nextChoice,52000),3000);
});

test("Dealer can analyze during review, clock freezes and auto-resumes after capped 20 seconds", () => {
  assert.equal(DEALER_PAUSE_MS,20000);
  const room={game:"choice",seats:[{id:"a",stack:100},{id:"b",stack:100}],button:"a",rotation:["texas"]};
  prepareDealerChoice(room,{texas:{max:10}},50000);
  const choice=room.nextChoice;
  assert.equal(holdDealerChoice(choice,48000),true);
  assert.equal(choice.heldAt,50000);
  assert.equal(choice.holdUntil,70000);
  assert.equal(choiceTimeLeft(choice,68000),5000);
  assert.equal(resumeDealerChoice(choice,72000),true);
  assert.equal(choice.at,75000,"timer must not resume later than 20 seconds after choice begins");
  assert.equal(choiceTimeLeft(choice,74000),1000);
});

test("Closing analysis early resumes remaining choice time without resetting it",()=>{
  const room={game:"choice",seats:[{id:"a",stack:100},{id:"b",stack:100}],button:"a",rotation:["texas"]};
  prepareDealerChoice(room,{texas:{max:10}},50000);
  const choice=room.nextChoice;
  assert.equal(holdDealerChoice(choice,51500),true);
  assert.equal(choice.remainingMs,3500);
  assert.equal(resumeDealerChoice(choice,56500),true);
  assert.equal(choice.at,60000);
  assert.equal(holdDealerChoice(choice,60001),false);
});

test("NEXOR: public SEO but private table and admin routes never indexed",()=>{
  const robots=read("../public/robots.txt");
  const sitemap=read("../public/sitemap.xml");
  const html=read("../index.html");
  const server=read("../server/start.mjs");
  const manifest=JSON.parse(read("../public/manifest.webmanifest"));
  assert.match(robots,/Disallow: \/admin/);
  assert.match(robots,/Disallow: \/mesa\//);
  assert.match(sitemap,/<loc>https:\/\/royalepoker-2ga9.onrender.com\/<\/loc>/);
  assert.doesNotMatch(sitemap,/<loc>[^<]*\/admin/);
  assert.match(html,/apple-touch-icon/);
  assert.match(html,/property="og:title"/);
  assert.match(html,/application\/ld\+json/);
  assert.ok(manifest.icons.some(x=>x.sizes==="192x192"));
  assert.match(server,/X-Frame-Options/);
  assert.match(server,/X-Robots-Tag/);
  assert.match(server,/Content-Security-Policy/);
});

test("Admin: second password checked only on server; native browser popup absent",()=>{
 const server=read("../server/start.mjs");
 const gate=read("../src/AdminGate.tsx");
 const notice=read("../src/SystemNotice.tsx");
 const main=read("../src/main.tsx");
 assert.match(server,/process\.env\.POKER_ROYALE_ADMIN_CODE/);
 assert.match(server,/timingSafeEqual/);
 assert.match(server,/adminCommands\.has\(b\.cmd\)/);
 assert.match(gate,/type="password"/);
 assert.match(notice,/Estamos atualizando o servidor/);
 assert.match(main,/<SystemNotice/);
 for (const str of [main,gate,notice])
   assert.doesNotMatch(str,/\bwindow\.(?:alert|confirm|prompt)\s*\(/);
});
