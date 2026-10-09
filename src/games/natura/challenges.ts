import type { NaturaWorld } from './world.ts';
import { snapPlatforms } from './wildModes.ts';
import { createFoodSites } from './sharedFood.ts';

export const WILD_HINTS = {
  meadow: 'Use the same hunt rules while exploring your field skills.',
  bolas: 'Master lure placement and shared moth catches.',
  archerfish: 'Predict the landing and race your rival to shared food.',
  flyingfish: 'Space chooses when to leap or dive. Gliding drains energy; swimming refills it. Both predator types approach.',
  coconut: 'Reef pockets offer shelter without a shell. Central meals are worth two food; outer meals are safer.',
  cuttlefish: 'Some terrain patterns change every 12 seconds. Central shrimp are worth two food; outer routes offer safer meals.',
  trapjaw: 'Broad lower stepping stones offer a detour. A direct launch to the main ledges is faster.',
  jumpingspider: 'Wide side leaves offer shorter, safer jumps. The narrow central route is faster.',
  spermwhale: 'Currents push you in deep water. The third squid is deeper; plan your breath and return route.',
};
export function configureWildChallenge(w: NaturaWorld, solo: boolean) {
  if(w.kind==='flyingfish' && solo) { w.manual=true;w.glide=9;w.actionHeld=false;w.notice=WILD_HINTS.flyingfish; }
  if(w.kind==='coconut') {
    w.reefShelters=[{x:300,y:90},{x:600,y:450}];
    w.foodSites=createFoodSites([{x:235,y:85},{x:760,y:455},{x:480,y:215},{x:480,y:325}]);
    w.foodSites.forEach(s=>{s.value=s.id>1?2:1;});w.notice=WILD_HINTS.coconut;
  }
  if(w.kind==='cuttlefish') {
    w.tidal=true;w.tideStep=0;
    w.foodSites=createFoodSites([{x:210,y:85},{x:750,y:455},{x:480,y:215},{x:480,y:325}]);
    w.foodSites.forEach(s=>{s.value=s.id>1?2:1;});w.notice=WILD_HINTS.cuttlefish;
  }
  if(w.kind==='trapjaw') {
    const shelves=snapPlatforms(w);
    w.detours=shelves.slice(1).map((s,i)=>({x:(shelves[i].x+shelves[i].width+s.x)/2-35,y:Math.max(s.y,shelves[i].y)+30,width:70}));
    w.notice=WILD_HINTS.trapjaw;
  }
  if(w.kind==='jumpingspider') {
    const original=[...w.platforms];
    w.platforms.push(...original.slice(1).map((p,i)=>({x:(p.x+original[i].x)/2+1.4,y:(p.y+original[i].y)/2,z:(p.z+original[i].z)/2,radius:2.5,checkpoint:false,routeProgress:i})));
    w.notice=WILD_HINTS.jumpingspider;
  }
  if(w.kind==='spermwhale') { w.currents=true;w.squids.forEach((s,i)=>{if(i%3===2){s.y=-58;s.z=18;}});w.notice=WILD_HINTS.spermwhale; }
}
