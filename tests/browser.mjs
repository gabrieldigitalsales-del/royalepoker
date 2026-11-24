// Real browser smoke/audit for the current Poker Royale UI, replacing the
// obsolete server/local.mjs test. Uses an isolated temporary database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const temporary = mkdtempSync(join(tmpdir(), "royale-browser-audit-"));
const port = Number(process.env.TEST_PORT || 0) || (42000 + Math.floor(Math.random()*5000));
const base = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["server/start.mjs"], {
  env: { ...process.env, HOST:"127.0.0.1", PORT:String(port),
    DATA_FILE:join(temporary,"data.sqlite"),
    DATABASE_URL:"", SUPABASE_URL:"", SUPABASE_ANON_KEY:"",
    ADMIN_EMAIL:"browser-owner@example.test" },
  stdio:["ignore","pipe","pipe"],
});
let stderr = "";
server.stderr.on("data", data=>{stderr += data.toString().slice(0,6000)});
let browser;
const errors=[];
async function request(cmd, token="", extra={}) {
  const r = await fetch(base+"/api",{method:"POST",headers:{"Content-Type":"application/json",
      Authorization:"Bearer "+token},body:JSON.stringify({cmd,...extra})});
  const data=await r.json();
  if(!r.ok) throw Error(cmd+": "+(data.error||r.status));
  return data;
}
async function ready() {
  for(let i=0;i<130;i++) {
    if(server.exitCode!==null)throw Error("Server exited: "+stderr);
    try { const res=await fetch(base+"/health");if(res.ok)return; } catch{}
    await new Promise(r=>setTimeout(r,90));
  }
  throw Error("Local Poker Royale server not ready: "+stderr);
}
async function openRoom(token, viewport, label, roomId, expectedCards=2) {
  const context=await browser.newContext({viewport, deviceScaleFactor:1,locale:"pt-BR"});
  await context.addInitScript(value=>localStorage.setItem("mesaToken",value),token);
  const page=await context.newPage();
  page.on("pageerror",err=>errors.push(label+": "+err.message));
  await page.goto(base+"/mesa/"+roomId,{waitUntil:"domcontentloaded"});
  await page.locator(".portrait-table").waitFor({timeout:20000});
  await page.locator(".player-hand .card[data-royale-card='face']").first().waitFor({timeout:15000});
  await page.waitForTimeout(450);
  const cards=await page.locator(".player-hand .card[data-royale-card='face']").count();
  assert.equal(cards,expectedCards,label+" must show "+expectedCards+" cards");
  const cardInfo=await page.locator(".player-hand .card[data-royale-card='face']").evaluateAll(elements=>
    elements.map(card=>{
      const rank=card.querySelector("svg .royale-card-vector-rank");
      const suit=card.querySelector("svg .royale-card-vector-suit");
      const svg=card.querySelector("svg.royale-card-face-art");
      const cardBox=card.getBoundingClientRect();
      const rankBox=rank?.getBoundingClientRect();
      const suitBox=suit?.getBoundingClientRect();
      const display=svg && getComputedStyle(svg).display;
      return {rank:rank?.textContent,suit:card.getAttribute("data-suit"),suitVector:!!suit?.querySelector("path,circle"),
        width:cardBox.width,height:cardBox.height,display,
        rankInside:!!rankBox&&rankBox.width>0&&rankBox.left>=cardBox.left-2&&rankBox.right<=cardBox.right+2
          &&rankBox.top>=cardBox.top-2&&rankBox.bottom<=cardBox.bottom+2,
        suitInside:!!suitBox&&suitBox.width>0&&suitBox.left>=cardBox.left-2&&suitBox.right<=cardBox.right+2
          &&suitBox.top>=cardBox.top-2&&suitBox.bottom<=cardBox.bottom+2,
        hiddenFallback:getComputedStyle(card.querySelector("strong")).display==="none",
      };
    }));
  for(const card of cardInfo) {
    assert.match(card.rank,/^(?:[2-9]|10|[AJQK])$/,JSON.stringify(card));
    assert.match(card.suit,/^[shdc]$/,JSON.stringify(card));
    assert.ok(card.suitVector,label+" SVG suit has no visible vector geometry: "+JSON.stringify(card));
    assert.ok(card.width >= 28 && card.height >= 38,label+" card must not collapse: "+JSON.stringify(card));
    assert.equal(card.display,"block",label+" SVG face displayed");
    assert.ok(card.rankInside,label+" rank not clipped: "+JSON.stringify(card));
    assert.ok(card.suitInside,label+" suit not clipped: "+JSON.stringify(card));
    assert.ok(card.hiddenFallback,label+" old oversized HTML rank hidden");
  }
  const screenshot=join("artifacts","royale-"+label+".png");
  await page.screenshot({path:screenshot,fullPage:true,animations:"disabled"});
  return {page,context,cards,cardInfo};
}
try {
  mkdirSync("artifacts",{recursive:true});
  await ready();
  const a=await request("register","",{name:"Visual Owner",email:"browser-owner@example.test",password:"password12345"});
  const b=await request("register","",{name:"Visual Opponent",email:"browser-opponent@example.test",password:"password12345"});
  const room=await request("create",a.token,{name:"Visual Audit",game:"texas",blind:10,buy:100,capacity:2,seconds:30});
  await request("sit",b.token,{room:room.id,position:1,amount:150});
  const state=await request("room",a.token,{room:room.id});
  assert.equal(state.seats.length,2,"Both players seated");
  await request("deal",a.token,{room:room.id});
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const views=[];
  for(const [label,token,viewport] of [
    ["mobile-360",a.token,{width:360,height:740}],
    ["mobile-390",b.token,{width:390,height:844}],
    ["desktop-1366",a.token,{width:1366,height:768}],
  ]) views.push(await openRoom(token,viewport,label,room.id));
  // Real game screens for the variants prone to hidden symbols on phones.
  for (const [game,expectedCards] of [["watermelon",4],["om5db",5],["om7",7]]) {
    const fresh=await request("create",a.token,{name:"Browser "+game,
      game,blind:10,buy:100,capacity:2,seconds:30});
    await request("sit",b.token,{room:fresh.id,position:1,amount:150});
    await request("deal",a.token,{room:fresh.id});
    views.push(await openRoom(a.token,{width:360,height:740},
      game+"-mobile-360",fresh.id,expectedCards));
  }
  assert.deepEqual(errors,[],"No browser uncaught errors");
  console.log("REAL BROWSER VISUAL AUDIT PASS",views.map((v,i)=>({
    viewport:["360x740","390x844","1366x768"][i],cards:v.cards,face:v.cardInfo,
  })));
  for(const v of views)await v.context.close();
} finally {
  if(browser)await browser.close();
  server.kill("SIGTERM");
  await new Promise(resolve=>{
    if(server.exitCode!==null||server.signalCode!==null)return resolve();
    server.once("exit",resolve);setTimeout(resolve,2500);
  });
  rmSync(temporary,{recursive:true,force:true});
}
