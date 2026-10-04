declare const Deno: {env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
declare module 'jsr:@supabase/supabase-js@2' { export {createClient, SupabaseClient} from '@supabase/supabase-js'; }
