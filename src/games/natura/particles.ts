export type Spark = { x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;duration:number;color:string };
/** Fixed-capacity, cosmetic pool. It never touches the simulation's random state. */
export class NaturaParticles {
  readonly sparks: Spark[] = [];
  private sequence = 0;
  readonly capacity: number;
  constructor(capacity = 160) { this.capacity=Math.max(1,Math.trunc(capacity)); }
  burst(position: number[], color: string, count = 14, buoyant = false) {
    for(let i=0;i<count;i++) {
      const angle=(this.sequence++*2.3999632297), speed=0.7+(i%5)*0.32;
      if(this.sparks.length>=this.capacity)this.sparks.shift();
      this.sparks.push({x:position[0],y:position[1],z:position[2],vx:Math.cos(angle)*speed,vy:buoyant?0.7+(i%3)*0.3:1.5+(i%4)*0.4,vz:Math.sin(angle)*speed,life:0.8+(i%4)*0.1,duration:1.1,color});
    }
  }
  step(seconds: number, buoyant = false) {
    if(!Number.isFinite(seconds)||seconds<=0)return;
    const dt=Math.min(seconds,0.1);
    for(let i=this.sparks.length-1;i>=0;i--) {
      const p=this.sparks[i];p.life-=dt;
      if(p.life<=0){this.sparks.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy+=(buoyant?0.4:-3)*dt;
    }
  }
  clear() { this.sparks.length=0; }
}
