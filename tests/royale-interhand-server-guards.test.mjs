import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Multi-run early settle: API blocks next hand, replay, chip top-up and seat changes", {timeout:55000}, async()=>{
 const dir=mkdtempSync(join(tmpdir(),"royale-interhand-"));
 const port=47000+Math.floor(Math.random()*1500),url="http://127.0.0.1:"+port;
 const server=spawn(process.execPath,["server/start.mjs"],{env:{
  ...process.env,HOST:"127.0.0.1",PORT:String(port),DATA_FILE:join(dir,"game.db"),
  DATABASE_URL:"",SUPABASE_URL:"",SUPABASE_ANON_KEY:"",
 },stdio:["ignore","pipe","pipe"]});
 let stderr="";
 server.stderr.on("data",b=>stderr+=b.toString().slice(0,2000));
 async function api(cmd,token="",args={}){
  const resp=await fetch(url+"/api",{method:"POST",headers:{Authorization:"Bearer "+token,
   "Content-Type":"application/json"},body:JSON.stringify({cmd,...args})});
  const body=await resp.json();
  if(!resp.ok)throw Error(body.error||cmd+" failed");
  return body;
 }
 try {
  for(let tries=0;tries<150;tries++){
   if(server.exitCode!==null)throw Error(stderr);
   try{if((await fetch(url+"/health")).ok)break;}catch{}
   await new Promise(ok=>setTimeout(ok,75));
  }
  const users=[];
  for(const [i,name] of ["Alpha","Bravo"].entries()){
   const r=await api("register","",{name,email:`guard-${i}@example.test`,password:"testPassword123"});
   users.push({token:r.token,id:(await api("home",r.token)).me.id});
  }
  const created=await api("create",users[0].token,{
   name:"Multi-run guard test",game:"texas",blind:10,buy:100,capacity:2,seconds:30});
  const room=created.id;
  await api("sit",users[1].token,{room,position:1,amount:150});
  await api("deal",users[0].token,{room});
  let finished;
  for(let turn=0;turn<55;turn++){
   const view=await api("room",users[0].token,{room});
   if(!view.live){finished=view;break;}
   const frame=view.live.frames[0];
   const actor=users.find(u=>u.id===view.live.players[frame.actor].id);
   assert.ok(actor,"actor must be one of the two test users");
   const own=await api("room",actor.token,{room});
   const legal=own.live.frames[0].legal;
   let action;
   if(Array.isArray(legal.runout)) action={type:"runout",count:3};
   else if(legal.max!=null)action={type:"raise",amount:legal.max};
   else if("call" in legal)action={type:"pass"};
   else if(legal.fold)action={type:"fold"};
   else throw Error("No legal action: "+JSON.stringify(legal));
   await api("move",actor.token,{room,rev:own.rev,action});
  }
  assert.ok(finished?.lastHand,"hand should settle");
  const finalFrame=finished.lastHand.frames[0];
  assert.equal(finalFrame.boards.length,3,"must run all three boards");
  const handId=finished.lastHand.id;
  await assert.rejects(api("deal",users[0].token,{room}),/revisão da mão/);
  await assert.rejects(api("replay",users[0].token,{hand:handId}),/última carta/);
  await assert.rejects(api("rebuy",users[0].token,{room,amount:20}),/premiação/);
  await assert.rejects(api("seat",users[0].token,{room,position:0}),/premiação/);
  await assert.rejects(api("leave",users[0].token,{room}),/Aguarde a revelação/);
  const before=await api("room",users[1].token,{room});
  const stack=before.seats.find(s=>s.id===users[1].id).stack;
  const grant=await api("grantChips",users[0].token,{
   room,id:users[1].id,amount:10,destination:"carteira",reference:"e".repeat(32)});
  assert.equal(grant.destination,"carteira","grant must NOT enter staged table stack");
  const after=await api("room",users[1].token,{room});
  assert.equal(after.seats.find(s=>s.id===users[1].id).stack,stack,"no displayed table prize changes");
 } finally {
  server.kill("SIGTERM");
  await new Promise(resolve=>{
   if(server.exitCode!==null||server.signalCode!==null)return resolve();
   server.once("exit",resolve);setTimeout(resolve,2500);
  });
  rmSync(dir,{recursive:true,force:true});
 }
});
