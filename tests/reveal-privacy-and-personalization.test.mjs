import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {viewFrame} from '../server/game.mjs';
import {stop} from '../server/worker.mjs';
after(stop);
const players=[{id:'a',name:'Ana'},{id:'b',name:'Bruno'}];
function frame(awards){return {finished:true,public:[[true,true],[false,false]], hole:[['As','Kd'],['2h','3h']], awards,combinations:[['Pair'],['High card']], hiddenRows:[],legal:{},active:[true,false],payouts:[50,0]}}
test('fold victory hides involuntary cards and respects opted-in revealed cards',()=>{
 const h={players,showCards:{b:[1]}};
 const v=viewFrame(h,frame([{uncontested:true,winners:[{index:0,amount:50,cards:[],label:null}]}]),'b');
 assert.deepEqual(v.hole[0],[null,null]);
 assert.deepEqual(v.hole[1],['2h','3h']);
 const spectator=viewFrame(h,frame([{uncontested:true,winners:[{index:0,amount:50,cards:[],label:null}]}]),'third');
 assert.deepEqual(spectator.hole[0],[null,null]);
 assert.deepEqual(spectator.hole[1],[null,'3h']);
});
test('contested showdown can expose engine-public cards',()=>{
 const h={players,showCards:{}};
 const spectator=viewFrame(h,frame([{uncontested:false,winners:[{index:0,amount:50,cards:['As','Kd'],label:'Pair'}]}]),'third');
 assert.deepEqual(spectator.hole[0],['As','Kd']);
 assert.deepEqual(spectator.hole[1],[null,null]);
});
test('three saved visual presets use valid server styles and replay mini has no height clipping',()=>{
 const lobby=readFileSync(new URL('../src/Lobby.tsx',import.meta.url),'utf8');
 for(const preset of ['Arena Royale','Noite Imperial','Salão Rubi']) assert.match(lobby,new RegExp(preset));
 const css=readFileSync(new URL('../src/royale-ui-system.css',import.meta.url),'utf8');
 assert.match(css,/max-height:none!important/);
 assert.match(css,/royale-replay-miniature/);
});
