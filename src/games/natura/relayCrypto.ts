/** Ephemeral pair keys keep per-seat snapshots opaque on the shared Realtime topic.
 * The room host is trusted; this is not independent authority or authenticated matchmaking. */
export async function makeRelayIdentity() {
  const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
  return {keys,publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey)};
}
export async function pairRelayKey(privateKey:CryptoKey,publicKey:JsonWebKey) {
  const remote=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
  return crypto.subtle.deriveKey({name:'ECDH',public:remote},privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
const encode=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function sealRelay(key:CryptoKey,value:unknown,context:string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},key,new TextEncoder().encode(JSON.stringify(value)));
  return {iv:encode(iv),data:encode(new Uint8Array(data))};
}
export async function openRelay(key:CryptoKey,box:{iv:string;data:string},context:string):Promise<unknown> {
  if(box.iv.length!==16||box.data.length>180000)throw new Error('Invalid relay payload.');
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(box.iv),additionalData:new TextEncoder().encode(context)},key,decode(box.data));
  return JSON.parse(new TextDecoder().decode(data));
}
