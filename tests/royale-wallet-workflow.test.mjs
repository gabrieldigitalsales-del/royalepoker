import test from "node:test";
import assert from "node:assert/strict";
import {
  royalWalletView,requestRoyalWithdrawal,createDepositIntent,
  decideRoyalWithdrawal,royalWalletAdminView
} from "../server/royal-wallet.mjs";

function fixture(){
 const user={id:"alice",name:"Alice",wallet:500,walletReserved:0};
 const admin={id:"owner",name:"Owner",admin:true};
 return {user,admin,d:{users:{alice:user,owner:admin},rooms:{},
   walletRequests:{},events:{}}};
}
const r1="00000000-0000-4000-8000-000000000001";
const r2="00000000-0000-4000-8000-000000000002";
test("request reserves chips atomically, prevents reuse and is idempotent",()=>{
 const {d,user}=fixture();
 requestRoyalWithdrawal(d,user,300,r1);
 assert.equal(user.wallet,200);assert.equal(user.walletReserved,300);
 assert.equal(royalWalletView(d,user).available,200);
 requestRoyalWithdrawal(d,user,300,r1);
 assert.equal(user.wallet,200);assert.equal(user.walletReserved,300);
 assert.throws(()=>requestRoyalWithdrawal(d,user,201,r2),/insuficiente/);
 assert.throws(()=>requestRoyalWithdrawal(d,user,301,r1),/inválida/);
});
test("reject refunds reserved chips exactly once, approval never pays out automatically",()=>{
 const {d,user,admin}=fixture();
 requestRoyalWithdrawal(d,user,250,r1);
 decideRoyalWithdrawal(d,admin,r1,"approve");
 assert.equal(user.wallet,250);assert.equal(user.walletReserved,250);
 decideRoyalWithdrawal(d,admin,r1,"approve");
 assert.equal(user.walletReserved,250);
 decideRoyalWithdrawal(d,admin,r1,"reject");
 assert.equal(user.wallet,500);assert.equal(user.walletReserved,0);
 decideRoyalWithdrawal(d,admin,r1,"reject");
 assert.equal(user.wallet,500);
 assert.throws(()=>decideRoyalWithdrawal(d,admin,r1,"complete"),/Aprove/);
});
test("completed virtual redemption removes reservation but does not mint chips",()=>{
 const {d,user,admin}=fixture();
 requestRoyalWithdrawal(d,user,200,r1);
 decideRoyalWithdrawal(d,admin,r1,"approve");
 decideRoyalWithdrawal(d,admin,r1,"complete");
 assert.equal(user.wallet,300);assert.equal(user.walletReserved,0);
 assert.throws(()=>decideRoyalWithdrawal(d,admin,r1,"reject"),/não pode/);
});
test("deposit is only pending intention and never credits wallet or marks Pix paid",()=>{
 const {d,user}=fixture();
 const intent=createDepositIntent(d,user,100,r2);
 assert.equal(intent.status,"awaiting_provider");
 assert.equal(user.wallet,500);
 assert.equal(royalWalletView(d,user).pixConnected,false);
 assert.equal(royalWalletView(d,user).depositsEnabled,false);
 assert.equal(royalWalletAdminView(d).length,1);
});
test("wallet UI and server permissions never embed a pix payment secret",()=>{
 const fs=await import("node:fs");
 const path=await import("node:url");
 const read=p=>fs.readFileSync(path.fileURLToPath(new URL(p,import.meta.url)),"utf8");
 const api=read("../server/start.mjs");
 const html=read("../src/RoyalWallet.tsx");
 assert.match(api,/case "royalWalletDecision"/);
 assert.match(api,/adminCommands\.has\(b\.cmd\)/);
 assert.match(api,/case "royalWithdrawalRequest"/);
 assert.match(html,/Não executa pagamentos/);
});
