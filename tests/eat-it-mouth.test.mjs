import test from 'node:test';
import assert from 'node:assert/strict';
import { FOOD, EAT, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, stepGame, collectPower } from '../src/games/eat-it/engine.ts';
import { canEatPlayer, entersMouth, foodFits, mouthOpening, MOUTH } from '../src/games/eat-it/rules.ts';
import { collideObjects, objectContact } from '../src/games/eat-it/physics.ts';
function scene(kind='apple', dx=12, dy=0) {
 const s=createGame('city',[{id:'a',name:'A'},{id:'b',name:'B'}],41,'mouth',{livesEnabled:false});
 s.food=[];s.powerups=[];s.nextFood=1e6;s.nextPower=1e6;
 Object.assign(s.players[0],{x:1050,y:800,facing:0});Object.assign(s.players[1],{x:1900,y:1000});
 const f={id:s.nextId++,kind,x:1050+dx,y:800+dy,vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0};s.food.push(f);
 return {s,p:s.players[0],f};
}
const advance=(s,n=30)=>{for(let i=0;i<n;i++)stepGame(s)};
test('entry reserves once, falls down, and awards only after crossing depth',()=>{
 const {s,p,f}=scene();stepGame(s);assert.equal(f.target,p.id);assert.ok(f.z<0);assert.equal(p.mass,36);
 advance(s,20);assert.equal(s.food.length,0);assert.equal(p.mass,41);advance(s);assert.equal(p.mass,41);
});
test('food outside the visible opening stays still without Magnet, including body and grazing contacts',()=>{
 for(const [dx,dy] of [[50,0],[-24,0],[0,24],[12,19]]) {
  const {s,p,f}=scene('berry',dx,dy);advance(s,10);assert.equal(p.foodEaten,0);assert.equal(f.target,null);
  assert.equal(f.x,1050+dx);assert.equal(f.y,800+dy);assert.equal(f.vx,0);assert.equal(f.vy,0);
 }
});
test('fitting food over the opening is collected from any direction, including during turns',()=>{
 for(const [dx,dy] of [[12,0],[-12,0],[0,12],[0,-12]]) {
  const {s,p,f}=scene('apple',dx,dy);f.vx=60;f.vy=40;
  assert.equal(entersMouth(p,f,0),true);stepGame(s);assert.equal(f.target,p.id);
  advance(s,20);assert.equal(p.foodEaten,1);
 }
});
test('starting-size players collect offset snacks without kicking them ahead',()=>{
 for(const kind of ['berry','apple','cupcake','coin'])for(const side of [-12,0,12]) {
  const {s,p,f}=scene(kind,65,side);p.input={x:1,y:0};
  const start={x:f.x,y:f.y};
  for(let tick=0;tick<35&&!f.target;tick++) {
   stepGame(s);
   if(!f.target)assert.deepEqual({x:f.x,y:f.y},start);
  }
  assert.equal(f.target,p.id,`${kind} at lateral offset ${side}`);
  advance(s,20);assert.equal(p.foodEaten,1);
 }
});
test('airborne props must fall to the lip, not disappear overhead',()=>{
 const {s,p,f}=scene();f.z=50;f.vz=-1;stepGame(s);assert.equal(f.target,null);
 advance(s,40);assert.equal(p.foodEaten,1);
});
test('area alone determines fit, including equality and long objects at every orientation',()=>{
 const {p,f}=scene('bench');p.mass=100;
 assert.ok(FOOD.bench.width>mouthOpening(p));
 for(const kind of ['bench','car','house']) {
  f.kind=kind;
  const threshold=FOOD[kind].width*FOOD[kind].height/(Math.PI*(EAT.player.radiusScale*MOUTH.radius)**2);
  for(const rotation of [0,Math.PI/4,Math.PI/2,Math.PI])for(const facing of [0,1,2]) {
   f.rotation=rotation;p.facing=facing;
   p.mass=threshold;assert.equal(foodFits(p,f),true);
   p.mass=threshold-.01;assert.equal(foodFits(p,f),false);
   p.mass=threshold+.01;assert.equal(foodFits(p,f),true);
  }
 }
});
test('an area-fitting sideways bench can actually be swallowed',()=>{
 const {s,p,f}=scene('bench');p.mass=100;f.rotation=Math.PI/2;
 stepGame(s);assert.equal(f.target,p.id);advance(s,20);assert.equal(p.foodEaten,1);
});
test('solid car contact follows its rotated footprint rather than its enclosing circle',()=>{
 const {p,f}=scene('car',0);const r=playerRadius(p,0);
 for(const rotation of [0,Math.PI/4,Math.PI/2]) {
  f.rotation=rotation;
  const place=(offset)=>{p.x=f.x-Math.sin(rotation)*offset;p.y=f.y+Math.cos(rotation)*offset;};
  place(FOOD.car.height/2+r+1);assert.equal(objectContact(p,r,f),null);
  place(FOOD.car.height/2+r-2);const contact=objectContact(p,r,f);
  assert.ok(contact);assert.ok(Math.abs(contact.overlap-2)<1e-8);
  assert.ok(Math.abs(contact.nx-Math.sin(rotation))<1e-8);
  assert.ok(Math.abs(contact.ny+Math.cos(rotation))<1e-8);
 }
});
test('an oversized building blocks movement, remains stable and cannot be magnetized',()=>{
 const {s,p,f}=scene('house',80);p.effects.magnet=10;const before={x:f.x,y:f.y,rotation:f.rotation};
 p.input={x:1,y:0};advance(s,30);
 assert.equal(p.foodEaten,0);assert.equal(f.target,null);assert.ok(Math.hypot(f.x-before.x,f.y-before.y)<.05);assert.equal(f.z,0);
});
test('grown player can devour a house, with a longer collapse and a bounded significant reward',()=>{
 const {s,p,f}=scene('house',70);p.mass=1800;assert.ok(foodFits(p,f));
 stepGame(s);assert.equal(f.target,p.id);advance(s,20);assert.equal(p.foodEaten,0);assert.ok(f.z<0);
 advance(s,20);assert.equal(p.foodEaten,1);assert.ok(p.mass>=1950&&p.mass<=1980);assert.equal(s.food.length,0);
});
test('130% size threshold, rear contact, shields, and physical victim fit are required',()=>{
 const {s,p}=scene();s.food=[];const victim=s.players[1];Object.assign(victim,{x:p.x+15,y:p.y});
 p.mass=36*1.3**2-.01;assert.equal(canEatPlayer(p,victim,0,s.map),false);
 p.mass=36*1.3**2;assert.equal(canEatPlayer(p,victim,0,s.map),true);
 victim.effects.shield=1;assert.equal(canEatPlayer(p,victim,0,s.map),false);victim.effects.shield=0;
 victim.x=p.x-15;assert.equal(canEatPlayer(p,victim,0,s.map),false);
});
test('approaching an edible opponent crosses the front mouth instead of being blocked by body separation',()=>{
 const {s,p}=scene();s.food=[];p.mass=144;p.input={x:1,y:0};Object.assign(s.players[1],{x:p.x+100,y:p.y});
 advance(s,45);assert.equal(p.playersEaten,1);assert.equal(s.status,'finished');
});
test('tiny props bounce more; buildings have finite mass and resist small impulses',()=>{
 assert.ok(FOOD.coin.bounce>FOOD.car.bounce);assert.ok(FOOD.car.mass>FOOD.chair.mass);
 const {f:a}=scene('coin');const {f:b}=scene('house');b.id=a.id+1;b.x=a.x+FOOD.house.radius;
 a.vx=80;const bx=b.x;collideObjects([a,b]);assert.ok(b.x>bx&&b.x-bx<.01);assert.ok(b.vx>0&&b.vx<.1);assert.ok(a.vx<0);
});
test('catalog has varied progression and genuinely different map distributions',()=>{
 assert.ok(Object.keys(FOOD).length>=40);
 for(const category of ['tiny','small','medium','large','very-large','huge'])assert.ok(Object.values(FOOD).some(f=>f.category===category));
 assert.equal(FOOD.cabin.rarity.city,0);assert.equal(FOOD.apartment.rarity.nature,0);
 for(const f of Object.values(FOOD))assert.ok(f.width>0&&f.height>0&&f.mass>0&&f.growth>0&&f.score>0);
 assert.ok(FOOD.house.growth>FOOD.apple.growth*10);assert.equal(EAT.match.maxPlayers,8);
});
test('bots continue underneath supported oversized buildings while seeking food',async()=>{
 const {botInput}=await import('../src/games/eat-it/bots.ts');
 const {s,p,f}=scene('house',150);p.mass=100;s.players[1].x=2100;
 s.food.push({...f,id:f.id+1,kind:'berry',x:p.x+350});
 const input=botInput(s,p);assert.deepEqual(input,{x:1,y:0});assert.ok(Math.hypot(input.x,input.y)>.9);
});
