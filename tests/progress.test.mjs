import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function storage(raw=null){const data=new Map(raw?[['kr-rally:progress-1',raw]]:[]),window={KR_PLAYER_CATALOG:[{id:'khlif'},{id:'waters'},{id:'platel'}],KR_RALLY:{version:'rally-8'},addEventListener(){}};const context=vm.createContext({window,structuredClone,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}});vm.runInContext(readFileSync(new URL('../rally-progress.js',import.meta.url),'utf8'),context);return {store:window.KR_RALLY_PROGRESS,data};}
const run={edition:'fr',mode:'classic',style:'arcade',precision:false,day:'',score:20,level:2};
test('device progress survives reload and isolates mode, precision, edition and day',()=>{
 const {store,data}=storage();assert.equal(store.finish(run),0);assert.equal(store.finish({...run,score:30}),20);assert.equal(store.best(run),30);
 for(const patch of [{edition:'us'},{style:'advanced'},{precision:true},{mode:'daily',day:'2026-10-31'}])assert.equal(store.best({...run,...patch}),0);
 store.finish({...run,mode:'daily',day:'2026-10-31',score:50});assert.equal(store.best({...run,mode:'daily',day:'2026-11-01'}),0);
 assert.equal(storage(data.get('kr-rally:progress-1')).store.best(run),30);
});
test('collection deduplicates shared identities and history stays bounded without private data',()=>{
 const {store,data}=storage();store.meet('khlif');store.meet('khlif');store.meet('not-real');for(let i=0;i<35;i++)store.finish({...run,score:i,token:'secret',email:'private@example.com',inputs:[[0,20,30]]});
 assert.equal(store.snapshot().met.length,1);assert.equal(store.snapshot().history.length,20);const saved=data.get('kr-rally:progress-1');for(const secret of ['secret','private@example.com','inputs'])assert.ok(!saved.includes(secret));
});
test('corrupt or invalid progress cannot break startup or inject records',()=>{
 assert.equal(storage('{broken').store.best(run),0);const {store}=storage(JSON.stringify({met:['bad','khlif'],history:[{...run,score:-1}],bests:{'bad-key':500,'fr:rally-8:classic:arcade:normal:':-10}}));assert.equal(store.snapshot().history.length,0);assert.equal(store.best(run),0);assert.equal(store.snapshot().met.length,1);
});

test('worker installs without taking over and never intercepts API requests',async()=>{
 const handlers={},calls=[],self={registration:{scope:'https://example.com/KitchenRush/'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>calls.push('activate'),clients:{claim:()=>{}}};
 const context=vm.createContext({self,URL,location:{origin:'https://example.com'},caches:{open:async()=>({addAll:async files=>{assert.ok(files.includes('./rally-progress.js'));assert.ok(files.includes('./manifest-us.json'));}})}});
 vm.runInContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);
 let install;handlers.install({waitUntil:p=>install=p});await install;assert.equal(calls.length,0);
 let intercepted=false;handlers.fetch({request:{url:'https://example.com/KitchenRush/api/runs',method:'POST'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
 handlers.message({data:{type:'ACTIVATE'}});assert.equal(calls.length,1);
});
