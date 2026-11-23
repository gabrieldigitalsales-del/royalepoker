import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const installed=['ws','zod','@supabase/supabase-js'].every(name=>{try{require.resolve(name);return true}catch{return false}});

test('Mostrar carta persists after fold and reveals only voluntarily selected cards', {timeout:22000,skip:!installed&&'Servidor não tem dependências npm instaladas'}, async()=>{
 const tmp=mkdtempSync(join(tmpdir(),'royale-postshow-'));
 const port=45267;const url=`http://127.0.0.1:${port}`;
 const srv=spawn(process.execPath,['server/start.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_FILE:join(tmp,'data.sqlite')},stdio:['ignore','pipe','pipe']});
 try {
  await Promise.race([new Promise((resolve,reject)=>{srv.stdout.once('data',resolve);srv.once('exit',code=>reject(Error('server exit '+code)))}),new Promise((_,reject)=>setTimeout(()=>reject(Error('server not started')),9000))]);
  const call=async (cmd,token='',body={})=>{const response=await fetch(url+'/api',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({...body,cmd})});const data=await response.json();if(!response.ok) throw Error(data.error);return data};
  const a=(await call('register','',{name:'Alex',email:'alex-' + port+'@test.net',password:'password123'})).token;
  const b=(await call('register','',{name:'Bia',email:'bia-' + port+'@test.net',password:'password123'})).token;
  const c=(await call('register','',{name:'Caio',email:'caio-' + port+'@test.net',password:'password123'})).token;
  const {id:room}=await call('create',a,{name:'Post Show',game:'texas',capacity:2,buy:100,blind:10,seconds:30});
  await call('sit',b,{room});
  await call('deal',a,{room});
  let r=await call('room',a,{room});
  const who=r.live.players[r.live.frames[0].actor].id;
  const aId=(await call('home',a)).me.id;
  const actorToken=who===aId?a:b;
  const actorId=who;
  await call('move',actorToken,{room,rev:r.rev,action:{type:'fold'}});
  r=await call('room',actorToken,{room});
  assert.equal(r.live,null);
  assert.equal(r.lastHand.frames[0].finished,true);
  const handId=r.lastHand.id;
  await call('showCards',actorToken,{room,handId,indices:[0]});
  r=await call('room',actorToken,{room});
  assert.deepEqual(r.lastHand.showCards[actorId],[0]);
  const other=await call('room',actorToken===a?b:a,{room});
  const idx=other.lastHand.players.findIndex(p=>p.id===actorId);
  assert.equal(typeof other.lastHand.frames[0].hole[idx][0],'string');
  assert.equal(other.lastHand.frames[0].hole[idx][1],null);
  await assert.rejects(call('showCards',c,{room,handId,indices:[1]}));
  await assert.rejects(call('showCards',actorToken,{room,handId:'wrong',indices:[1]}));
 } finally {
  srv.kill();
  await new Promise(done=>{if(srv.exitCode!==null||srv.signalCode!==null)return done();srv.once('exit',done);setTimeout(done,2000)});
  rmSync(tmp,{recursive:true,force:true});
 }
});
