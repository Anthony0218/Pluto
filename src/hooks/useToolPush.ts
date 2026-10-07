import type { LifeToolsState } from '@/data/lifeToolsStorage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { useLifeTools } from './useLifeTools';
import { pushSupported, vapidBytes, type DeliveryCheck } from '@/data/toolNotifications';
import { ui } from '@/i18n/ui';
type Status = { syncing: boolean; error: boolean; lastSync: number };
const statuses = new Map<string,Status>(), listeners = new Set<() => void>(), empty: Status = { syncing:false,error:false,lastSync:0 };
const notify = (account:string,value:Status) => { statuses.set(account,value); listeners.forEach(fn=>fn()); };
export function usePushStatus(account:string) { const get = useCallback(()=>statuses.get(account)??empty,[account]); return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},get,get); }
const bindingKey='pluto-tool-push-device-v1';
let sessionBinding: {account:string;device:string}|null = null;
export function pushBinding() { try { const value=JSON.parse(localStorage.getItem(bindingKey)??'null'); return value && typeof value.account==='string' && typeof value.device==='string' ? value as {account:string;device:string} : sessionBinding; } catch { return sessionBinding; } }
function setBinding(value:typeof sessionBinding) { sessionBinding=value; try { if(value) localStorage.setItem(bindingKey,JSON.stringify(value));else localStorage.removeItem(bindingKey); } catch { /* Keep session binding. */ } }
export async function pushAction<T>(account:string,body:Record<string,unknown>):Promise<T> {
  const {data:{session}}=await supabase.auth.getSession(); if(!session || session.user.id!==account) throw Error('Sign in required');
  const {data,error}=await supabase.functions.invoke('tool-push',{body,headers:{Authorization:`Bearer ${session.access_token}`}});
  if(error || data?.error) throw Error('Delivery service unavailable'); return data as T;
}
export type PushOverview = { devices:{id:string;created_at:string;updated_at:string}[]; deliveries:DeliveryCheck[]; reminders:{id:string;title:string;at:string;enabled:boolean}[] };
export async function enablePush(account:string) {
  if(!pushSupported()) throw Error('Unsupported');
  // Called directly from a click, before any network await, to preserve the permission gesture.
  const permission=await Notification.requestPermission(); if(permission!=='granted') throw Error('Permission denied');
  const config=await pushAction<{configured:boolean;publicKey:string}>(account,{action:'config'}); if(!config.configured) throw Error('Setup unavailable');
  const registration=await navigator.serviceWorker.register('/tool-reminders-sw.js',{scope:'/'});
  await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  if(subscription && pushBinding()?.account!==account) { await subscription.unsubscribe(); subscription=null; }
  subscription ??= await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(config.publicKey)});
  const result=await pushAction<{id:string}>(account,{action:'subscribe',subscription:subscription.toJSON(),labels:{birthday:ui('Birthday reminder'),task:ui('Task reminder'),test:ui('Delivery test'),body:ui('This device received the test.')}});
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id !== account) { await subscription.unsubscribe(); throw Error('Account changed'); }
  setBinding({account,device:result.id});
}
export async function disablePush(account:string) {
  const binding=pushBinding();
  // Unsubscribe first so this browser stops receiving even if the service is unavailable.
  const registration=await navigator.serviceWorker?.getRegistration('/'); const subscription=await registration?.pushManager.getSubscription(); await subscription?.unsubscribe();
  setBinding(null);
  if(binding?.account===account) await pushAction(account,{action:'unsubscribe',device:binding.device});
}
export default function useToolPushBridge() {
  const {state,account,loading,update}=useLifeTools();
  useEffect(()=>{
    if(loading || !pushSupported()) return;
    let active=true;
    // A browser push endpoint belongs to one account. Guest mode and account switches invalidate the old endpoint.
    const cleanup=async()=> { const binding=pushBinding(); if(binding && binding.account!==account || account==='guest') { const registration=await navigator.serviceWorker.getRegistration('/'); if(!active)return; await (await registration?.pushManager.getSubscription())?.unsubscribe(); if(active)setBinding(null); } };
    void cleanup().catch(()=>{});
    return()=>{active=false;};
  },[account,loading]);
  const queueKey = JSON.stringify(state.background);
  useEffect(()=>{
    const background: LifeToolsState['background'] = JSON.parse(queueKey);
    if(loading || account==='guest' || !background.enabled || !background.pending.length) return;
    let active=true, running=false;
    const pending=background.pending.slice(0,200);
    async function send() {
      if(running || !active || !navigator.onLine) return; running=true;
      notify(account,{...statuses.get(account)??empty,syncing:true});
      try {
        await pushAction(account,{action:'reminders',changes:pending});
        if(!active)return;
        notify(account,{syncing:false,error:false,lastSync:Date.now()});
        update(s=>({...s,background:{...s.background,pending:s.background.pending.filter(r=>!pending.some(sent=>JSON.stringify(sent)===JSON.stringify(r)))}}));
      } catch { if(active)notify(account,{...statuses.get(account)??empty,syncing:false,error:true}); }
      finally {running=false;}
    }
    void send(); const timer=window.setInterval(()=>void send(),30000); window.addEventListener('online',send);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',send);};
  },[account,loading,queueKey,update]);
}
