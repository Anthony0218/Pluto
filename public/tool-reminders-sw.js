/* Dedicated push worker: no fetch interception or asset caching. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function acknowledge(data, clicked = false) {
  try {
    const url = new URL(data.ackUrl);
    if (url.pathname !== '/functions/v1/tool-push' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname)))) return;
    await fetch(url.href, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'ack',token:data.token,clicked}) });
  } catch { /* Offline acknowledgements leave provider acceptance as the last known status. */ }
}
self.addEventListener('push', event => event.waitUntil((async () => {
  let data; try { data = event.data?.json(); } catch { return; }
  if (!data || typeof data.title !== 'string' || typeof data.body !== 'string' || typeof data.token !== 'string') return;
  await self.registration.showNotification(data.title.slice(0,150), { body:data.body.slice(0,200), tag:data.tag, data:{token:data.token,ackUrl:data.ackUrl,url:data.url==='/tools/birthday-reminders'?data.url:'/tools/day-planner'} });
  await acknowledge(data);
})()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const data=event.notification.data;
    await acknowledge(data,true);
    const url=new URL(data.url==='/tools/birthday-reminders'?data.url:'/tools/day-planner',self.location.origin).href;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing) { await existing.navigate(url); await existing.focus(); } else await self.clients.openWindow(url);
  })());
});
