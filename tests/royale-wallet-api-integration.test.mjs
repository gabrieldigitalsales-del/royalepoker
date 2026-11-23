import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
const getPort=()=>new Promise((resolve,reject)=>{const s=createServer();s.listen(0,"127.0.0.1",()=>{const port=s.address().port;s.close(()=>resolve(port))});s.on("error",reject)});
test("Royal Wallet HTTP flow: login, reserve, deny buyin, refund, admin approval, deposit not paid", {timeout:45000}, async()=>{
 const dir=mkdtempSync(join(tmpdir(),"royale-wallet-api-"));
 const port=await getPort(),url="http://127.0.0.1:"+port;
 const password="test-unique-admin-secret";
 const processServer=spawn(process.execPath,["server/start.mjs"],{
  env:{...process.env,PORT:String(port),HOST:"127.0.0.1",DATA_FILE:join(dir,"poker.db"),
   DATABASE_URL:"",SUPABASE_URL:"",SUPABASE_ANON_KEY:"",ADMIN_EMAIL:"owner@example.test",
   POKER_ROYALE_ADMIN_CODE:password},stdio:["ignore","pipe","pipe"]
 });
 let stderr="";
 processServer.stderr.on("data",b=>{stderr+=b.toString().slice(0,3000)});
 async function req(cmd,token="",args={}){
  const res=await fetch(url+"/api",{method:"POST",headers:{"content-type":"application/json",
   authorization:"Bearer "+token},body:JSON.stringify({...args,cmd})});
  const data=await res.json();
  if(!res.ok)throw Error(data.error??"HTTP "+res.status);
  return data;
 }
 try{
  for(let attempt=0;attempt<120;attempt++){
    if(processServer.exitCode!==null)throw Error("Server terminated: "+stderr);
    try{const r=await fetch(url+"/health");if(r.ok)break;}catch{}
    await new Promise(r=>setTimeout(r,85));
  }
  const admin=await req("register","",{name:"Owner",email:"owner@example.test",password:"password1234"});
  const member=await req("register","",{name:"Member",email:"member@example.test",password:"password1234"});
  const before=await req("royalWallet",member.token);
  assert.ok(before.available>=500);
  const ref="123e4567-e89b-42d3-a456-426614174000",amount=Math.min(150,before.available);
  const booked=await req("royalWithdrawalRequest",member.token,{reference:ref,amount});
  assert.equal(booked.status,"pending");
  const state=await req("royalWallet",member.token);
  assert.equal(state.available,before.available-amount);
  assert.equal(state.reserved,amount);
  assert.ok(state.requests.some(x=>x.id===ref&&x.status==="pending"));
  await req("royalWithdrawalRequest",member.token,{reference:ref,amount});
  const again=await req("royalWallet",member.token);
  assert.equal(again.reserved,amount);
  await assert.rejects(req("royalWalletAdmin",member.token),/Desbloqueie|permissão/i);
  await assert.rejects(req("royalWalletAdmin",admin.token),/Desbloqueie/i);
  const adminHome=await req("home",admin.token);
  assert.equal(adminHome.me.admin,true);
  assert.equal((await req("adminAuthStatus",admin.token)).unlocked,false);
  await assert.rejects(req("adminUnlock",admin.token,{password:"wrongPassword"}),/incorreta/);
  await req("adminUnlock",admin.token,{password});
  assert.equal((await req("adminAuthStatus",admin.token)).unlocked,true);
  let requests=(await req("royalWalletAdmin",admin.token)).requests;
  assert.ok(requests.some(x=>x.id===ref));
  await req("royalWalletDecision",admin.token,{id:ref,action:"approve"});
  assert.equal((await req("royalWallet",member.token)).reserved,amount);
  await req("royalWalletDecision",admin.token,{id:ref,action:"reject"});
  const returned=await req("royalWallet",member.token);
  assert.equal(returned.available,before.available);
  assert.equal(returned.reserved,0);
  const dep="123e4567-e89b-42d3-a456-426614174001";
  const deposit=await req("royalDepositIntent",member.token,{reference:dep,amount:75});
  assert.equal(deposit.status,"awaiting_provider");
  const final=await req("royalWallet",member.token);
  assert.equal(final.available,before.available);
  assert.equal(final.pixConnected,false);
 }finally{
  processServer.kill("SIGTERM");
  await new Promise(resolve=>{if(processServer.exitCode!==null||processServer.signalCode!==null)return resolve();processServer.once("exit",resolve);setTimeout(resolve,3500)});
  rmSync(dir,{recursive:true,force:true});
 }
});