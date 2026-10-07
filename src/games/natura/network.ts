import { supabase } from '../../lib/supabase';
import { NaturaRelay, type NaturaRelayChannel } from './relay';
import type { PrivateState } from './protocol';

/** Supabase relays encrypted packets; the room creator's browser runs the match. Both players are signed in. */
export class NaturaConnection extends NaturaRelay {
  private visibility=()=>{if(document.hidden)this.pauseForHiddenTab();};
  private leaving=()=>this.detach();
  constructor(onState:(state:PrivateState|null)=>void,onStatus:(status:string,error?:string)=>void) {
    super(topic=>{
      // Private channel: only signed-in players can join a room topic.
      const channel=supabase.channel(topic,{config:{private:true,broadcast:{self:false,ack:true}}});
      const adapter:NaturaRelayChannel={
        on(event,filter,callback){channel.on(event,filter,callback);return adapter;},
        subscribe(callback){channel.subscribe(callback);return adapter;},
        send(message){return channel.send(message);},
        unsubscribe(){return supabase.removeChannel(channel);},
      };
      return adapter;
    },onState,onStatus);
    document.addEventListener('visibilitychange',this.visibility);
    window.addEventListener('pagehide',this.leaving);
  }
  override close(){document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.leaving);super.close();}
}
