import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { FOOD, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, stepGame } from '../src/games/eat-it/engine.ts';
import { beginFall, fallPose, objectHeight } from '../src/games/eat-it/falling.ts';
import { consumptionDuration, mouthPosition, MOUTH } from '../src/games/eat-it/rules.ts';
import { ModelLibrary } from '../src/games/eat-it/models.ts';

function scene(map, kind, side) {
  const s = createGame(map, [{id:'a',name:'A'}, {id:'b',name:'B'}], 91);
  s.food=[]; s.powerups=[]; s.nextFactory=s.nextHumans=1e9;delete s.feast;s.nextFood=1e6; s.nextPower=1e6; s.nextBig=1e9;
  const p=s.players[0]; Object.assign(p,{x:1100,y:800,mass:kind==='house'?1800:kind==='car'?700:36,facing:0});
  Object.assign(s.players[1],{x:1900,y:1000});
  const mouth=mouthPosition(p,playerRadius(p,0)), radius=playerRadius(p,0)*MOUTH.radius;
  const f={id:s.nextId++,kind,x:mouth.x+side[0]*radius*.94,y:mouth.y+side[1]*radius*.94,vx:0,vy:0,z:0,vz:0,rotation:.3,target:null,capturedAt:0};
  s.food.push(f); return {s,p,f};
}
for (const map of ['city','nature']) test(`${map}: all four entry sides tip into the lost support, including cars and houses`,()=>{
  for(const kind of ['apple','car','house']) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const {s,p,f}=scene(map,kind,[dx,dy]); stepGame(s);
    assert.equal(f.target,p.id); assert.ok(f.fallX*-dx+f.fallY*-dy>.99);
    const pose=fallPose(f,consumptionDuration(f)*.5); assert.ok(pose.angle>0); assert.ok(pose.z<0);
    const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(f.fallY,0,-f.fallX),pose.angle);
    const top=new T.Vector3(0,objectHeight(kind),0).applyQuaternion(q);
    assert.ok(top.x*f.fallX+top.z*f.fallY>0,'roof/top leans toward the hole');
    const edge=new T.Vector3(f.fallX*10,0,f.fallY*10).applyQuaternion(q);
    assert.ok(edge.y<0,'unsupported edge goes down first');
    const far=new T.Vector3(-f.fallX*10,0,-f.fallY*10).applyQuaternion(q);
    assert.ok(far.y>edge.y,'opposite edge stays higher');
  }
});
test('turning an eater cannot swivel the world-space fall direction or footprint',()=>{
 const {s,p,f}=scene('city','car',[1,0]);stepGame(s);
 const direction=[f.fallX,f.fallY], rotation=f.rotation;
 p.facing=Math.PI/2;stepGame(s);
 assert.deepEqual([f.fallX,f.fallY],direction);assert.equal(f.rotation,rotation);
 assert.ok(f.x>p.x);assert.ok(Math.abs(f.y-p.y)<1e-8);
});
test('complete symmetric support loss drops straight down, and all poses stay finite',()=>{
 const {s,p,f}=scene('city','apple',[0,0]); beginFall(f,p,s.time);
 for(const kind of Object.keys(FOOD)) {
  f.kind=kind;beginFall(f,p,s.time);
  const pose=fallPose(f,consumptionDuration(f)*.6);
  assert.equal(pose.angle,0);assert.equal(pose.shift,0);assert.ok(Number.isFinite(pose.z));assert.ok(pose.z<0);
 }
});
test('every catalog prop has volumetric meshes, stays full-sized and clears the floor before its reward',()=>{
 const library=new ModelLibrary();
 for(const kind of Object.keys(FOOD)) {
  const model=library.prop(kind), bounds=new T.Box3().setFromObject(model), size=bounds.getSize(new T.Vector3());
  assert.ok(size.x>0&&size.y>0&&size.z>0,kind);
  assert.deepEqual(model.scale.toArray(),[1,1,1]);
  const {p,f}=scene('city',kind,[1,0]);beginFall(f,p,0);
  const pose=fallPose(f,consumptionDuration(f));
  model.quaternion.setFromAxisAngle(new T.Vector3(f.fallY,0,-f.fallX),pose.angle);
  model.position.y=pose.z;model.updateMatrixWorld(true);
  assert.ok(new T.Box3().setFromObject(model).max.y<0,`${kind}: all parts below ground before award`);
 }
 library.dispose();
});
test('serialized partial falls resume deterministically and grant a single reward',()=>{
 const {s,p,f}=scene('nature','house',[0,-1]);stepGame(s);assert.equal(f.target,p.id);
 for(let i=0;i<8;i++)stepGame(s);
 const clone=JSON.parse(JSON.stringify(s));
 for(let i=0;i<60;i++){stepGame(s);stepGame(clone);}
 assert.deepEqual(s,clone);assert.equal(p.foodEaten,1);assert.equal(s.food.length,0);
});

test('building roofs have outward-facing slopes so they render above the walls',()=>{
 const library=new ModelLibrary();
 // Towers and the windmill have flat/conical tops instead of a gabled prism.
 for(const kind of Object.keys(FOOD).filter(k=>FOOD[k].shape==='building'&&!['skyscraper','officeTower','windmill'].includes(k))) {
  const roof=library.prop(kind).getObjectByName('roof');assert.ok(roof,kind);
  const normal=roof.geometry.getAttribute('normal');
  // First six vertices are gable ends; next twelve are the two pitched slopes.
  for(let i=6;i<18;i++)assert.ok(normal.getY(i)>0,`${kind}: upward roof normal`);
 }
 library.dispose();
});
