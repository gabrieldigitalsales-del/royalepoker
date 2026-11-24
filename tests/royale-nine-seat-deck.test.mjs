import test, { after } from "node:test";
import assert from "node:assert/strict";
import { makeRoom, sit, MAX_TABLE_PLAYERS, availableSeats } from "../server/game.mjs";
import { catalog } from "../server/catalog.mjs";
import { stop } from "../server/worker.mjs";
after(stop);
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("All poker modes advertise no more than nine player seats",()=>{
 assert.equal(MAX_TABLE_PLAYERS,9);
 assert.ok(Object.values(catalog).every(game=>game.max<=9));
});
test("Server accepts nine-seat table but rejects ten or more",()=>{
 const u={id:"owner",name:"Owner",wallet:10000};
 const base={name:"Mesa Royale",game:"texas",blind:10,buy:100,seconds:25,capacity:9};
 const room=makeRoom(u,base);
 assert.equal(room.capacity,9);
 assert.throws(()=>makeRoom(u,{...base,capacity:10}),/2 e 9/);
 assert.throws(()=>makeRoom(u,{...base,capacity:11}),/2 e 9/);
});
test("Legacy 10-seat room never lets a tenth participant join",()=>{
 const d={users:{},hands:{},cashier:{}};
 const owner={id:"owner",name:"Owner",wallet:2000};
 d.users[owner.id]=owner;
 const room=makeRoom(owner,{name:"Test",game:"texas",blind:10,buy:100,seconds:25,capacity:9});
 room.capacity=10; // Previous persisted tables: preserve players, block new 10th seat.
 for(let i=0;i<9;i++){
   const user={id:"player-"+i,name:"Jogador "+i,wallet:2000};
   d.users[user.id]=user;
   sit(d,user,room,{position:i,amount:100});
 }
 assert.equal(room.seats.length,9);
 assert.equal(availableSeats(room),0);
 const newcomer={id:"player-10",name:"Décimo",wallet:2000};
 d.users[newcomer.id]=newcomer;
 assert.throws(()=>sit(d,newcomer,room,{position:9,amount:100}),/máximo de 9/);
});
test("Lobby, queued seat selection and live table enforce nine slots",()=>{
 const lobby=read("../src/Lobby.tsx");
 const start=read("../server/start.mjs");
 const face=read("../src/PortraitBoard.tsx");
 assert.match(start,/capacity: z\.number\(\)\.int\(\)\.min\(2\)\.max\(9\)/);
 assert.match(start,/check\(availableSeats\(r\) > 0/);
 assert.match(lobby,/Math\.min\(9,/);
 assert.match(lobby,/max="9"/);
 assert.match(face,/9: \[\[50, 80\]/);
});
test("Royal deck keeps one suit and enhanced readable typography",()=>{
 const cards=read("../src/ui.tsx");
 const css=read("../src/royale-premium-cards.css");
 const face=cards.slice(cards.indexOf('{c ? ('),cards.indexOf(') : (',cards.indexOf('{c ? (')));
 assert.equal((face.match(/card-emblem/g)||[]).length,1);
 assert.doesNotMatch(face,/<i>\{suits\[c\[1\]\]\}<\/i>/);
 assert.match(css,/Royal deck v2/);
 assert.match(css,/data-rank="10"/);
 assert.match(css,/royale-multiple-boards/);
});
