declare const Deno: {env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
declare module 'jsr:@supabase/supabase-js@2' { export {createClient} from '@supabase/supabase-js'; }
declare module 'npm:web-push@3.6.7' {
 const webpush:{generateRequestDetails(subscription:{endpoint:string;keys:{p256dh:string;auth:string}},payload:string,options:{vapidDetails:{subject:string;publicKey:string;privateKey:string};TTL:number;urgency:string}):{endpoint:string;headers:Record<string,string>;body:Uint8Array<ArrayBuffer>}};
 export default webpush;
}
