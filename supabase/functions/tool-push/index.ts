import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { validSubscription, validReminder, terminalPushFailure } from './model.ts';
const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const vapidPublic = Deno.env.get('TOOL_PUSH_VAPID_PUBLIC'), vapidPrivate = Deno.env.get('TOOL_PUSH_VAPID_PRIVATE'), subject = Deno.env.get('TOOL_PUSH_VAPID_SUBJECT'), cronSecret = Deno.env.get('TOOL_PUSH_CRON_SECRET');
const configured = !!(vapidPublic && vapidPrivate && subject && cronSecret);
const allowedOrigins = (Deno.env.get('TOOL_PUSH_ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function dispatch(userId?:string) {
  if (!configured) throw Error('Push setup unavailable');
  const { data: jobs, error } = await db.rpc('tool_push_claim',{p_user:userId??null}); if (error) throw error;
  let accepted = 0;
  await Promise.all((jobs ?? []).map(async (j: { delivery_id: string; device_id: string; subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; labels: Record<string,string>; title: string; ack_token: string; test: boolean; birthday?: boolean; attempts: number }) => {
    // Re-check cancellation immediately before sending; a reminder may have changed after the claim.
    const { data: active } = await db.from('tool_push_deliveries').select('id').eq('id',j.delivery_id).eq('status','sending').eq('attempts',j.attempts).maybeSingle();
    if (!active || !validSubscription(j.subscription)) return;
    try {
      const payload = JSON.stringify({ title: `Pluto · ${j.test ? j.labels.test ?? 'Delivery test' : j.birthday ? j.labels.birthday ?? 'Birthday reminder' : j.labels.task ?? 'Task reminder'}`, body: j.test ? j.labels.body ?? 'This device received the test.' : j.title, token:j.ack_token, ackUrl:`${url}/functions/v1/tool-push`, tag:`pluto-${j.delivery_id}`, url:j.birthday?'/tools/birthday-reminders':'/tools/day-planner' });
      const request = webpush.generateRequestDetails(j.subscription,payload,{vapidDetails:{subject:subject!,publicKey:vapidPublic!,privateKey:vapidPrivate!},TTL:3600,urgency:'normal'});
      const response = await fetch(request.endpoint,{method:'POST',headers:request.headers,body:new Uint8Array(request.body),signal:AbortSignal.timeout(10000),redirect:'error'});
      if (terminalPushFailure(response.status)) { await db.from('tool_push_devices').delete().eq('id',j.device_id); return; }
      if (!response.ok) throw Error('Push rejected');
      // An acknowledgement may race the provider response. Never downgrade shown/clicked.
      await db.from('tool_push_deliveries').update({status:'accepted',updated_at:new Date().toISOString(),lease_until:null}).eq('id',j.delivery_id).eq('status','sending').eq('attempts',j.attempts);
      accepted++;
    } catch {
      await db.from('tool_push_deliveries').update({status:j.attempts>=3?'failed':'pending',next_at:new Date(Date.now()+j.attempts*60000).toISOString(),lease_until:null,updated_at:new Date().toISOString()}).eq('id',j.delivery_id).eq('status','sending').eq('attempts',j.attempts);
    }
  }));
  return {accepted};
}
Deno.serve(async request => {
  const origin=request.headers.get('Origin'), cors: Record<string,string> = { 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin' };
  if(origin && allowedOrigins.includes(origin)) cors['Access-Control-Allow-Origin']=origin;
  const respond = (body: unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST') return respond({error:'Method not allowed'},405);
  if(origin && !allowedOrigins.includes(origin)) return respond({error:'Origin not allowed'},403);
  try {
    const raw=await request.text(); if(raw.length>100000) return respond({error:'Request too large'},413);
    const body=JSON.parse(raw);
    if(!body || typeof body!=='object') return respond({error:'Invalid request'},400);
    if(body.action==='dispatch') { if(!cronSecret || request.headers.get('Authorization')!==`Bearer ${cronSecret}`) return respond({error:'Unauthorized'},401); return respond(await dispatch()); }
    if(body.action==='ack') { if(!uuid(body.token) || typeof body.clicked!=='boolean') return respond({error:'Invalid acknowledgement'},400); const {error}=await db.rpc('tool_push_ack',{p_token:body.token,p_clicked:body.clicked}); if(error) throw error; return respond({ok:true}); }
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
    if(!token) return respond({error:'Sign in required'},401);
    const {data:{user},error:authError}=await db.auth.getUser(token); if(authError || !user) return respond({error:'Sign in required'},401);
    if(body.action==='config') return respond({configured,publicKey:configured?vapidPublic:null});
    if(body.action==='subscribe') {
      if(!configured) return respond({error:'Push setup unavailable'},503);
      if(!validSubscription(body.subscription)) return respond({error:'Invalid subscription'},400);
      const labels: Record<string,string>={}; for(const key of ['task','birthday','test','body']) if(typeof body.labels?.[key]==='string' && body.labels[key].length<=150) labels[key]=body.labels[key];
      const {data,error}=await db.rpc('tool_push_register',{p_user:user.id,p_subscription:body.subscription,p_labels:labels}); if(error) throw error; return respond({id:data});
    }
    if(body.action==='unsubscribe') { if(!uuid(body.device)) return respond({error:'Invalid device'},400); const {error}=await db.from('tool_push_devices').delete().eq('user_id',user.id).eq('id',body.device); if(error) throw error; return respond({ok:true}); }
    if(body.action==='reminders') {
      if(!Array.isArray(body.changes) || body.changes.length>500 || !body.changes.every(validReminder)) return respond({error:'Invalid reminders'},400);
      // Changes are per task; publishing one device never deletes another device's tasks.
      for(const r of body.changes) { const shared={p_user:user.id,p_id:r.id,p_title:r.title,p_enabled:r.enabled,p_revision:r.issuedAt??0}; const {error}=r.annual ? await db.rpc('tool_push_set_birthday',{...shared,p_month:r.annual.month,p_day:r.annual.day,p_zone:r.annual.zone}) : await db.rpc('tool_push_set_reminder',{...shared,p_at:new Date(r.at).toISOString()}); if(error) throw error; }
      return respond({ok:true});
    }
    if(body.action==='status') {
      const [devices,deliveries,reminders]=await Promise.all([db.from('tool_push_devices').select('id,created_at,updated_at').eq('user_id',user.id),db.from('tool_push_deliveries').select('id,device_id,status,attempts,created_at,updated_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),db.from('tool_push_reminders').select('id,title,at,enabled').eq('user_id',user.id).eq('enabled',true).order('at').limit(500)]);
      if(devices.error || deliveries.error || reminders.error) throw Error('Status unavailable'); return respond({devices:devices.data,deliveries:deliveries.data,reminders:reminders.data});
    }
    if(body.action==='test') { if(!configured) return respond({error:'Push setup unavailable'},503); if(body.device!==undefined && !uuid(body.device)) return respond({error:'Invalid device'},400); const {error}=await db.rpc('tool_push_test',{p_user:user.id,p_device:body.device??null}); if(error) return respond({error:'Wait one minute before another test.'},429); return respond(await dispatch(user.id)); }
    if(body.action==='cancel') { if(typeof body.id!=='string') return respond({error:'Invalid reminder'},400); const {data:reminder,error:lookupError}=await db.from('tool_push_reminders').select('title,at,client_revision').eq('user_id',user.id).eq('id',body.id).maybeSingle(); if(lookupError) throw lookupError; if(!reminder) return respond({ok:false}); const {error}=await db.rpc('tool_push_set_reminder',{p_user:user.id,p_id:body.id,p_title:reminder.title,p_at:reminder.at,p_enabled:false,p_revision:Math.max(Date.now(),Number(reminder.client_revision)+1)}); if(error) throw error; return respond({ok:true}); }
    return respond({error:'Unknown action'},400);
  } catch { return respond({error:'Delivery service unavailable. Check setup and try again.'},503); }
});
