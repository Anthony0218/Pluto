import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/tool-reminders-sw.js',import.meta.url),'utf8');
function worker(){const handlers={},shown=[],requests=[],opened=[];const client={url:'https://pluto.test/tools',navigate:async url=>opened.push(url),focus:async()=>opened.push('focus')};const self={location:{origin:'https://pluto.test'},addEventListener:(type,handler)=>handlers[type]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[client],openWindow:async url=>opened.push(url)},registration:{showNotification:async(title,options)=>shown.push({title,options})}};vm.runInNewContext(source,{self,URL,fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Response('{}');}});const fire=async(type,data)=>{let promise;handlers[type]({...data,waitUntil:p=>{promise=p;}});await promise;};return {shown,requests,opened,fire,self};}
const payload={title:'Task reminder',body:'Appointment',token:'00000000-0000-4000-8000-000000000001',ackUrl:'https://project.supabase.co/functions/v1/tool-push',tag:'delivery-1'};
test('a background push displays a stable-tag notification then acknowledges; clicking opens the planner and acknowledges reading action',async()=>{const w=worker();await w.fire('push',{data:{json:()=>payload}});assert.equal(w.shown.length,1);assert.equal(w.shown[0].options.tag,'delivery-1');assert.equal(w.requests[0].body.clicked,false);let closed=false;await w.fire('notificationclick',{notification:{data:w.shown[0].options.data,close:()=>{closed=true;}}});assert.equal(closed,true);assert.equal(w.requests[1].body.clicked,true);assert.deepEqual(w.opened,['https://pluto.test/tools/day-planner','focus']);});
test('malformed pushes do not display, unsafe acknowledgement destinations are ignored, and failed display never claims success',async()=>{const w=worker();await w.fire('push',{data:{json:()=>{throw Error('bad JSON');}}});await w.fire('push',{data:{json:()=>({title:'x'})}});assert.equal(w.shown.length,0);await w.fire('push',{data:{json:()=>({...payload,ackUrl:'http://attacker.test/functions/v1/tool-push'})}});assert.equal(w.shown.length,1);assert.equal(w.requests.length,0);w.self.registration.showNotification=async()=>{throw Error('Denied');};await assert.rejects(w.fire('push',{data:{json:()=>payload}}));assert.equal(w.requests.length,0);});

test('birthday notification clicks open the birthday app, and arbitrary destinations are ignored',async()=>{
 for(const destination of ['/tools/birthday-reminders','https://attacker.test/']){
  const w=worker();await w.fire('push',{data:{json:()=>({...payload,url:destination})}});
  await w.fire('notificationclick',{notification:{data:w.shown[0].options.data,close:()=>{}}});
  assert.equal(w.opened[0],`https://pluto.test${destination==='/tools/birthday-reminders'?destination:'/tools/day-planner'}`);
 }
});
