import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

/** Execute the actual Edge Function with an in-memory Supabase transport and a controllable clock.
 * Database permissions/migration triggers are separately tested against PostgreSQL (PGlite). */
export async function atlasEndpoint(){
 const matches=[],profiles=[],results=[];let handler,now=Date.parse('2026-10-03T12:00:00Z'),collision=null;
 class Query {
  constructor(table){this.table=table;this.filters=[];this.operation='select';}
  select(){return this;}eq(key,value){this.filters.push(row=>row[key]===value);return this;}in(key,values){this.filters.push(row=>values.includes(row[key]));return this;}
  insert(row){this.operation='insert';this.value=row;return this;}update(row){this.operation='update';this.value=row;return this;}upsert(row){this.operation='upsert';this.value=row;return this;}
  single(){return this.execute(true);}maybeSingle(){return this.execute(true);}then(resolve,reject){return this.execute(false).then(resolve,reject);}
  async execute(single){const table=this.table==='atlas_matches'?matches:this.table==='atlas_ranked_profiles'?profiles:results;
   if(this.operation==='insert'){const row={id:crypto.randomUUID(),match_kind:'casual',created_at:new Date(now).toISOString(),status:'waiting',round_index:0,tip_index:0,round_started_at:null,round_ends_at:null,resolve_at:null,submissions:[],ownership:{},round_result:null,state:{},version:0,...this.value};table.push(row);return {data:structuredClone(row),error:null};}
   if(this.operation==='upsert'&&!table.some(row=>row.user_id===this.value.user_id))table.push({rating:1500,deviation:350,volatility:.06,matches_played:0,...this.value});
   if(this.operation==='update'&&collision){const run=collision;collision=null;run(table);}
   const rows=table.filter(row=>this.filters.every(f=>f(row)));
   if(this.operation==='update')for(const row of rows)Object.assign(row,structuredClone(this.value));
   return {data:structuredClone(single?(rows[0]??null):rows),error:null};
  }
 }
 const client={auth:{getUser:async token=>({data:{user:token?{id:token}:null},error:null})},from:table=>new Query(table),rpc:async(name,args)=>{if(name==='atlas_apply_ranked_result'&&!results.some(r=>r.match_id===args.p_match)){results.push({match_id:args.p_match,...args});}return {data:null,error:null};}};
 globalThis.__atlasClient=()=>client;
 globalThis.Deno={env:{get:()=>''},serve:fn=>handler=fn};
 const original=new URL('../../supabase/functions/atlas-match/index.ts',import.meta.url);let source=await readFile(original,'utf8');
 source=source.replace(/import \{[^}]*\} from "jsr:@supabase\/supabase-js@2";/,'const createClient=globalThis.__atlasClient;');
 source=source.replace(/from "(\.[^"]+)"/g,(_,specifier)=>`from "${new URL(specifier,original).href}"`);
 await mkdir(new URL('../../.atlas-test/',import.meta.url),{recursive:true});
 const generated=new URL('../../.atlas-test/atlas-edge-test.mjs',import.meta.url);await writeFile(generated,stripTypeScriptTypes(source));await import(generated.href+'?'+crypto.randomUUID());
 const originalNow=Date.now;Date.now=()=>now;
 const call=async(user,body)=>{const response=await handler(new Request('http://atlas.test',{method:'POST',headers:{Authorization:'Bearer '+user},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 return {matches,profiles,results,call,setTime:value=>now=value,advance:ms=>now+=ms,now:()=>now,collide:fn=>collision=fn,close:()=>{Date.now=originalNow;delete globalThis.Deno;delete globalThis.__atlasClient;}};
}
