import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const tick=src.slice(src.indexOf('function tick()'),src.indexOf('async function refresh()'));
for(const [clock,hidden,status,label] of [['07:59:59',true,'volno','Obsazeno'],['08:00:00',false,'volno','Obsazeno'],['13:00:00',false,'tetování','Právě tetuji'],['15:59:59',false,'tetování','Právě tetuji'],['16:00:00',false,'volno','Dokončeno'],['20:00:00',true,'volno','Dokončeno']])test('Časová osa '+clock,()=>{
 const elements=new Map(),el=s=>{if(!elements.has(s))elements.set(s,{dataset:{lo:8,hi:20},style:{},querySelector:()=>el(s+' child')});return elements.get(s);};
 const block={dataset:{start:'13:00',end:'16:00'},classList:{toggle(){}},style:{setProperty(){}},querySelector:()=>el('label')};
 const context={state:{busy:[{date:'2026-10-30',start:'13:00',end:'16:00'}]},clockNow:()=>clock,dateNow:()=>'2026-10-30',min:t=>+t.slice(0,2)*60 + +t.slice(3,5),lastSync:Date.now(),hours:()=>['00:00','23:59'],selected:'2026-10-30',$:el,document:{querySelectorAll:()=>[block]}};
 vm.runInNewContext(tick+';tick()',context);
 assert.equal(el('.now-line').hidden,hidden);assert.match(el('#current-status').textContent,new RegExp(status));assert.equal(el('label').textContent,label);
});
