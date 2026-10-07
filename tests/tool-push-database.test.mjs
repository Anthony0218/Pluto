import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
async function database(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');`);await db.exec(readFileSync(new URL('../supabase/migrations/20261024010000_tool_push_reminders.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../supabase/migrations/20261026000000_birthday_reminders.sql',import.meta.url),'utf8'));return db;}
const register=async(db,user,endpoint)=> (await db.query('select tool_push_register($1,$2,$3) id',[user,{endpoint,keys:{p256dh:'test',auth:'test'}},{task:'Task reminder'}])).rows[0].id;
const reminder=async(db,user,id,title='Reminder',enabled=true)=>db.query("select tool_push_set_reminder($1,$2,$3,now()-interval '1 minute',$4)",[user,id,title,enabled]);
const claim=async db=>(await db.query('select * from tool_push_claim()')).rows;
test('due reminders fan out to account devices once, never to another user, with leased retries and monotonic acknowledgements',async()=>{
 const db=await database();try{const d1=await register(db,alice,'https://fcm.googleapis.com/one'),d2=await register(db,alice,'https://fcm.googleapis.com/two');await register(db,bob,'https://fcm.googleapis.com/three');await reminder(db,alice,'task');const jobs=await claim(db);assert.equal(jobs.length,2);assert.deepEqual(new Set(jobs.map(j=>j.device_id)),new Set([d1,d2]));assert.equal((await claim(db)).length,0);
 await db.query("update tool_push_deliveries set lease_until=now()-interval '1 minute' where id=$1",[jobs[0].delivery_id]);const retry=await claim(db);assert.equal(retry.length,1);assert.equal(retry[0].attempts,2);
 assert.equal((await db.query('select tool_push_ack($1,false) ok',[jobs[0].ack_token])).rows[0].ok,true);await db.query('select tool_push_ack($1,true)',[jobs[0].ack_token]);await db.query('select tool_push_ack($1,false)',[jobs[0].ack_token]);assert.equal((await db.query('select status from tool_push_deliveries where id=$1',[jobs[0].delivery_id])).rows[0].status,'clicked');assert.equal((await db.query('select tool_push_ack($1,false) ok',['00000000-0000-4000-8000-999999999999'])).rows[0].ok,false);
 }finally{await db.close();}
});
test('rescheduling or canceling removes queued deliveries; old reminders expire and retries stop at three',async()=>{
 const db=await database();try{await register(db,alice,'https://fcm.googleapis.com/one');await reminder(db,alice,'task');const [job]=await claim(db);await reminder(db,alice,'task','Reminder',false);assert.equal((await db.query('select count(*)::int n from tool_push_deliveries')).rows[0].n,0);assert.equal((await claim(db)).length,0);
 await reminder(db,alice,'task');await claim(db);await db.query("select tool_push_set_reminder($1,'task','New time',now()+interval '1 day',true)",[alice]);assert.equal((await claim(db)).length,0);assert.equal((await db.query('select count(*)::int n from tool_push_deliveries')).rows[0].n,0);
 await reminder(db,alice,'task');await claim(db);await db.exec("update tool_push_deliveries set attempts=3,lease_until=now()-interval '1 minute';");assert.equal((await claim(db)).length,0);assert.equal((await db.query('select status from tool_push_deliveries')).rows[0].status,'failed');
 await db.query("select tool_push_set_reminder($1,'expired','Old',now()-interval '2 days',true)",[alice]);assert.equal((await claim(db)).length,0);assert.ok(job.ack_token);
 }finally{await db.close();}
});
test('device ownership cannot be stolen, subscriptions are capped, tests are rate limited and direct client access is denied',async()=>{
 const db=await database();try{await assert.rejects(db.query('select tool_push_test($1,null)',[alice]));const device=await register(db,alice,'https://fcm.googleapis.com/one');await assert.rejects(register(db,bob,'https://fcm.googleapis.com/one'));for(let i=2;i<=10;i++)await register(db,alice,`https://fcm.googleapis.com/${i}`);await assert.rejects(register(db,alice,'https://fcm.googleapis.com/eleven'));assert.equal(await register(db,alice,'https://fcm.googleapis.com/one'),device);
 await db.query('select tool_push_test($1,$2)',[alice,device]);await assert.rejects(db.query('select tool_push_test($1,null)',[alice]));assert.equal((await claim(db)).length,1);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from tool_push_devices'));await assert.rejects(db.query('select tool_push_claim()'));await assert.rejects(db.query('select tool_push_set_reminder($1,$2,$3,now(),true)',[bob,'stolen','Bad']));await db.exec('reset role');
 await db.query('delete from tool_push_devices where id=$1',[device]);await assert.rejects(db.query('select tool_push_test($1,null)',[alice]));assert.equal((await db.query('select count(*)::int n from tool_push_deliveries')).rows[0].n,0);
 }finally{await db.close();}
});

test('late client retries cannot resurrect a cancellation or overwrite a newer task revision',async()=>{
 const db=await database();try{await register(db,alice,'https://fcm.googleapis.com/one');
 await db.query("select tool_push_set_reminder($1,'task','New',now(),true,200)",[alice]);
 await db.query("select tool_push_set_reminder($1,'task','Old',now(),true,100)",[alice]);
 assert.equal((await db.query("select title from tool_push_reminders")).rows[0].title,'New');
 await db.query("select tool_push_set_reminder($1,'task','New',now(),false,300)",[alice]);
 await db.query("select tool_push_set_reminder($1,'task','New',now(),true,200)",[alice]);
 assert.equal((await db.query("select enabled from tool_push_reminders")).rows[0].enabled,false);
 assert.equal((await claim(db)).length,0);
 }finally{await db.close();}
});

test('annual calendar calculations respect leap years and local daylight-saving time',async()=>{
 const db=await database();try {
  const next=async(month,day,zone,after)=>(await db.query('select tool_push_next_birthday($1,$2,$3,$4)::text at',[month,day,zone,after])).rows[0].at;
  assert.equal(Date.parse(await next(2,29,'Europe/Berlin','2027-01-01T00:00Z')),Date.parse('2027-02-28T08:00Z'));
  assert.equal(Date.parse(await next(2,29,'Europe/Berlin','2027-03-01T00:00Z')),Date.parse('2028-02-29T08:00Z'));
  assert.equal(Date.parse(await next(7,1,'Europe/Berlin','2027-01-01T00:00Z')),Date.parse('2027-07-01T07:00Z'));
  await assert.rejects(next(2,30,'UTC','2027-01-01T00:00Z'));await assert.rejects(next(1,1,'bad','2027-01-01T00:00Z'));
 }finally{await db.close();}
});
test('birthdays repeat without a browser, wait for all device outcomes, retain future schedules and honor cancellation revisions',async()=>{
 const db=await database();try {
  await register(db,alice,'https://fcm.googleapis.com/a');await register(db,alice,'https://fcm.googleapis.com/b');await register(db,bob,'https://fcm.googleapis.com/c');
  await db.query("select tool_push_set_birthday($1,'birthday-alex','Alex',2,29,'Europe/Berlin',true,100)",[alice]);
  await db.exec("update tool_push_reminders set at=now()-interval '1 minute'");
  const jobs=await claim(db);assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.birthday===true));
  await db.query("update tool_push_deliveries set status='accepted' where id=$1",[jobs[0].delivery_id]);await claim(db);
  assert.ok(Date.parse((await db.query('select at::text at from tool_push_reminders')).rows[0].at)<Date.now());
  await db.query("update tool_push_deliveries set status='accepted' where id=$1",[jobs[1].delivery_id]);assert.equal((await claim(db)).length,0);
  const future=(await db.query('select at::text at from tool_push_reminders')).rows[0].at;assert.ok(Date.parse(future)>Date.now());
  await db.query("select tool_push_set_birthday($1,'birthday-alex','Renamed',2,29,'Europe/Berlin',true,200)",[alice]);assert.equal((await db.query('select at::text at from tool_push_reminders')).rows[0].at,future);
  await db.exec("update tool_push_reminders set at=now()-interval '2 years',updated_at=now()-interval '2 years'");await claim(db);assert.equal((await db.query('select count(*)::int n from tool_push_reminders')).rows[0].n,1);assert.ok(Date.parse((await db.query('select at::text at from tool_push_reminders')).rows[0].at)>Date.now());
  await db.query("select tool_push_set_birthday($1,'birthday-alex','Renamed',2,29,'Europe/Berlin',false,300)",[alice]);await db.query("select tool_push_set_birthday($1,'birthday-alex','Stale',2,29,'Europe/Berlin',true,200)",[alice]);assert.equal((await db.query('select enabled from tool_push_reminders')).rows[0].enabled,false);
  await db.exec('set role authenticated');await assert.rejects(db.query("select tool_push_set_birthday($1,'birthday-hack','Hack',1,1,'UTC',true)",[bob]));await db.exec('reset role');
 }finally{await db.close();}
});
