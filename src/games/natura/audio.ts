import type { ScenarioId } from './naturaData.ts';
import type { GameCue } from './observations.ts';

/** Synthesized habitat ambience and short cues; no downloaded audio assets. */
export class NaturaAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = false;
  private enabled = true;
  private habitat: ScenarioId;
  constructor(habitat: ScenarioId) { this.habitat=habitat; }
  unlock(enabled: boolean) {
    this.enabled=enabled;
    if(!enabled)return;
    try {
      if(!this.context) {
        const ctx=this.context=new AudioContext();this.master=ctx.createGain();this.master.gain.value=0.12;this.master.connect(ctx.destination);
        const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate), samples=buffer.getChannelData(0);
        let value=0;for(let i=0;i<samples.length;i++){value=(value+Math.random()*0.04-0.02)*0.99;samples[i]=value;}
        const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
        const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=['spermwhale','flyingfish','coconut','cuttlefish','archerfish'].includes(this.habitat)?350:900;
        const gain=ctx.createGain();gain.gain.value=0.25;noise.connect(filter);filter.connect(gain);gain.connect(this.master);noise.start();
      }
      this.setActive(true);
    } catch { /* Play remains available when the browser disables audio. */ }
  }
  setEnabled(enabled: boolean) { this.enabled=enabled;if(this.master)this.master.gain.value=enabled?0.12:0; }
  setActive(active: boolean) {
    if(this.active===active)return;this.active=active;
    if(this.context) void (active?this.context.resume():this.context.suspend()).catch(()=>{});
  }
  cue(cue: GameCue) {
    if(!this.enabled||!this.active||!this.context||!this.master)return;
    const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
    const [start,end,length]=cue==='sonar'?[750,300,0.35]:cue==='catch'?[520,920,0.18]:cue==='checkpoint'?[420,1100,0.35]:cue==='hurt'?[160,65,0.2]:[230,480,0.08];
    osc.type=cue==='hurt'?'triangle':'sine';osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+length);
    gain.gain.setValueAtTime(0.001,now);gain.gain.exponentialRampToValueAtTime(0.6,now+0.015);gain.gain.exponentialRampToValueAtTime(0.001,now+length);
    osc.connect(gain);gain.connect(this.master);osc.start(now);osc.stop(now+length+0.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  dispose() { if(this.context)void this.context.close().catch(()=>{});this.context=null;this.master=null; }
}
