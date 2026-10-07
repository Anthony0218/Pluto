import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',eve='00000000-0000-4000-8000-000000000003';
async function database(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.profiles(id uuid primary key references auth.users(id),username text);insert into auth.users values('${alice}'),('${bob}'),('${eve}');insert into profiles values('${alice}','alice'),('${bob}','bob'),('${eve}','eve');grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261025000000_bill_splitter_groups.sql',import.meta.url),'utf8'));return db;
}
const as=async(db,user)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');};
const create=async db=>(await db.query("select bill_create('Dinner','EUR','Anna') id")).rows[0].id;
const list=async db=>(await db.query('select bill_list() data')).rows[0].data;
const save=(db,id,revision,expenses,repayments=[])=>db.query('select bill_save_ledger($1,$2,$3,$4)',[id,revision,JSON.stringify(expenses),JSON.stringify(repayments)]);
test('shared groups enforce membership, invitations, per-group names, server validation and stale-write protection',async()=>{
 const db=await database();try{
 await as(db,alice);const id=await create(db);assert.equal((await list(db)).groups[0].members[0].name,'Anna');
 await db.query('select bill_invite($1,$2)',[id,'BOB']);await db.query('select bill_invite($1,$2)',[id,'bob']);
 await as(db,eve);assert.equal((await list(db)).groups.length,0);assert.equal((await db.query('select * from bill_groups')).rows.length,0);
 await assert.rejects(save(db,id,0,[]));await assert.rejects(db.query('select bill_invite($1,$2)',[id,'eve']));
 await as(db,bob);const invitation=(await list(db)).invitations[0];assert.equal(invitation.name,'Dinner');
 await as(db,eve);await assert.rejects(db.query('select bill_accept($1,$2)',[invitation.id,'Imposter']));
 await as(db,bob);await db.query('select bill_accept($1,$2)',[invitation.id,'Max']);assert.equal((await list(db)).invitations.length,0);assert.equal((await list(db)).groups[0].members.find(m=>m.id===bob).name,'Max');
 await db.query('select bill_rename_member($1,$2)',[id,'Bobby']);assert.equal((await list(db)).groups[0].members.find(m=>m.id===alice).name,'Anna');
 const revision=(await list(db)).groups[0].revision;
 const expense={id:'dinner',title:'Dinner',date:'2026-10-06',paidBy:alice,amount:6300,subtotal:6000,tip:300,splitMethod:'custom',tipMethod:'person',tipPayer:bob,billShares:{[alice]:4000,[bob]:2000},tipShares:{[alice]:0,[bob]:300},shares:{[alice]:4000,[bob]:2300}};
 for(const bad of [{...expense,paidBy:eve},{...expense,date:'2026-02-30'},{...expense,shares:{[alice]:4000,[bob]:2200}},{...expense,shares:{[alice]:4000,[eve]:2300}},{...expense,billShares:{[alice]:4000,[bob]:1999}},{...expense,tipPayer:eve},{...expense,amount:63.1},{...expense,title:''},{...expense,tipShares:null},{...expense,date:null}]) await assert.rejects(save(db,id,revision,[bad]));
 await save(db,id,revision,[expense]);await assert.rejects(save(db,id,revision,[]));assert.deepEqual((await list(db)).groups[0].expenses,[expense]);
 await assert.rejects(db.query('update bill_groups set expenses=$1 where id=$2',['[]',id]));await assert.rejects(db.query('select bill_delete($1)',[id]));
 await assert.rejects(save(db,id,revision+1,[expense],[{id:'repay',date:'2026-10-06',from:bob,to:bob,amount:2300}]));
 await save(db,id,revision+1,[expense],[{id:'repay',date:'2026-10-06',from:bob,to:alice,amount:2300}]);
 await as(db,alice);assert.equal((await list(db)).groups[0].repayments[0].amount,2300);await db.query('select bill_delete($1)',[id]);assert.equal((await list(db)).groups.length,0);
 }finally{await db.close();}
});
