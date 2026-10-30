import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('Živý provoz bez e-mailů a okamžitá změna přes SSE', {timeout:15000}, async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'laura-live-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'32368',DATA_DIR:dir,ADMIN_PASSWORD:'local-test-password-12345',SESSION_SECRET:'local-test-session-secret-longer-than-32',APP_MODE:'live',PERSISTENT_STORAGE:'true',RESEND_API_KEY:'',EMAIL_FROM:'',SALON_EMAIL:'',RENDER:'',NODE_ENV:'test'},stdio:'pipe'});
 const stop=new AbortController();
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',code=>reject(Error('Server exit '+code)));child.once('error',reject);});
  const base='http://127.0.0.1:32368';
  const pub=await (await fetch(base+'/api/public')).json();assert.equal(pub.mode,'live');assert.equal(pub.emailEnabled,false);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'local-test-password-12345'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  const stream=await fetch(base+'/api/events',{signal:stop.signal});assert.match(stream.headers.get('content-type'),/text\/event-stream/);const reader=stream.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/event: ready/);
  const booking=await fetch(base+'/api/admin/bookings',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({date:pub.today,start:'13:00',end:'16:00',firstName:'Soukromé jméno'})});assert.equal(booking.status,200);
  const event=new TextDecoder().decode((await reader.read()).value);assert.match(event,/event: change/);assert.equal(event.includes('Soukromé'),false);
  const result=await (await fetch(base+'/api/public')).json();assert.deepEqual(result.busy,[{date:pub.today,start:'13:00',end:'16:00'}]);
  const invalid=await fetch(base+'/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({...pub.settings,appearance:{accent:'red',motion:true}})});assert.equal(invalid.status,400);
 }finally{stop.abort();if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});rmSync(dir,{recursive:true,force:true});}
});
