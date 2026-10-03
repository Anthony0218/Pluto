import * as T from 'three';
import { EAT } from './config.ts';
import { allBlackHoles, cellCenter, cellPhase, holeRadius, sweepPath } from './hell.ts';
import { mouthPosition } from './rules.ts';
import { playerRadius } from './config.ts';
import type { GameState } from './types.ts';
/** One instanced floor, one lava plane, and a bounded black-hole effect. */
export class HellVisuals {
  private group = new T.Group();
  private tileGeometry = new T.BoxGeometry(EAT.hell.cellSize - 1, 24, EAT.hell.cellSize - 1);
  private tileMaterial = new T.MeshStandardMaterial({ color: '#ffffff', roughness: .95 });
  private tiles = new T.InstancedMesh(this.tileGeometry, this.tileMaterial, EAT.hell.columns * EAT.hell.rows);
  private lavaGeometry = new T.PlaneGeometry(EAT.match.width * 2, EAT.match.height * 2);
  private lavaMaterial = new T.MeshStandardMaterial({ color: '#ef4115', emissive: '#d52b08', emissiveIntensity: .9, roughness: .5 });
  private clock = { value: 0 };
  private lava = new T.Mesh(this.lavaGeometry, this.lavaMaterial);
  private holeGeometry = new T.SphereGeometry(EAT.hell.radius, 24, 12);
  private holeMaterial = new T.MeshBasicMaterial({ color: '#080610' });
  private hole = new T.Mesh(this.holeGeometry, this.holeMaterial);
  private rimGeometry = new T.TorusGeometry(EAT.hell.radius, 5, 8, 48);
  private rimMaterial = new T.MeshBasicMaterial({ color: '#d279ff' });
  private rim = new T.Mesh(this.rimGeometry, this.rimMaterial);
  private pathGeometry = new T.BufferGeometry().setFromPoints(Array.from({length:25},()=>new T.Vector3()));
  private pathMaterial = new T.LineDashedMaterial({ color: '#ffb667', dashSize: 22, gapSize: 14 });

  private rings = Array.from({ length: 3 }, (_, i) => new T.Mesh(this.rimGeometry, new T.MeshBasicMaterial({ color: ['#502855','#ee553e','#ffae68'][i], transparent: true, opacity: .55-i*.1 })));
  private particleGeometry = new T.SphereGeometry(2.8, 6, 4);
  private particleMaterial = new T.MeshBasicMaterial({ color: '#ff9564' });
  private particles = new T.InstancedMesh(this.particleGeometry, this.particleMaterial, 40);
  private laserGeometry = new T.BoxGeometry(1, 1, 1);
  private laserMaterial = new T.MeshBasicMaterial({ color: '#ff4c58', transparent: true, opacity: .85 });
  private laser = new T.Mesh(this.laserGeometry, this.laserMaterial);
  private arrowGeometry = new T.ConeGeometry(24, 55, 3);
  private arrow = new T.Mesh(this.arrowGeometry, this.laserMaterial);
  private geyserGeometry = new T.ConeGeometry(EAT.hell.eruptionRadius*.7, 1, 12);
  private geyserMaterial = new T.MeshBasicMaterial({ color:'#ff521c', transparent:true, opacity:.94 });
  private geyserCoreMaterial = new T.MeshBasicMaterial({color:'#fff1a2'});
  private geyserCores = Array.from({length:2},()=>new T.Mesh(this.geyserGeometry,this.geyserCoreMaterial));
  private geyserParticles = new T.InstancedMesh(this.particleGeometry,this.geyserCoreMaterial,48);
  private geysers = Array.from({length:2},()=>new T.Mesh(this.geyserGeometry,this.geyserMaterial));
  private warningGeometry = new T.RingGeometry(EAT.hell.eruptionRadius*.75,EAT.hell.eruptionRadius,32);
  private warningMaterial = new T.MeshBasicMaterial({ color:'#ff7436',side:T.DoubleSide,transparent:true,opacity:.8 });
  private warnings = Array.from({length:2},()=>new T.Mesh(this.warningGeometry,this.warningMaterial));
  private effects = Array.from({length:3}, (_,i) => {
    const color = ['#ff5366','#ff994c','#dc77f5'][i];
    const laserMaterial = this.laserMaterial.clone(); laserMaterial.color.set(color);
    const rimMaterial = this.rimMaterial.clone(); rimMaterial.color.set(color);
    const pathGeometry = this.pathGeometry.clone(), pathMaterial = this.pathMaterial.clone(); pathMaterial.color.set(color);
    const hole = new T.Mesh(this.holeGeometry,this.holeMaterial); hole.scale.y=.2;
    const rim = new T.Mesh(this.rimGeometry,rimMaterial); rim.rotation.x=-Math.PI/2;
    const particles = new T.InstancedMesh(this.particleGeometry,this.particleMaterial,40); particles.frustumCulled=false;
    const rings = this.rings.map(r=>new T.Mesh(this.rimGeometry,r.material));
    const laser=new T.Mesh(this.laserGeometry,laserMaterial),arrow=new T.Mesh(this.arrowGeometry,laserMaterial);
    laser.name=i ? `sweep-laser-${i}` : 'sweep-laser'; arrow.name=i ? `sweep-arrow-${i}` : 'sweep-arrow';
    return { color, pathKey:'',hole,rim,rimMaterial,rings,particles,laser,arrow,path:new T.Line(pathGeometry,pathMaterial),pathGeometry,pathMaterial,laserMaterial };
  });
  // Fireballs: additive glow shells around a hot core, flickering flame tongues and rising embers.
  private fireCoreGeometry = new T.IcosahedronGeometry(EAT.hell.fireball.radius * .55, 2);
  private fireCoreMaterial = new T.MeshBasicMaterial({ color: '#fff3b0' });
  private fireGlowGeometry = new T.SphereGeometry(EAT.hell.fireball.radius, 16, 12);
  private fireGlowMaterials = ['#ffc23a', '#ff6a1c', '#ff3312'].map((color, i) => new T.MeshBasicMaterial({ color, transparent: true, opacity: [.9, .55, .26][i], blending: T.AdditiveBlending, depthWrite: false }));
  private flameGeometry = new T.ConeGeometry(EAT.hell.fireball.radius * .45, EAT.hell.fireball.radius * 2.1, 8);
  private flameMaterial = new T.MeshBasicMaterial({ color: '#ffa526', transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false });
  private fireballs = Array.from({ length: EAT.hell.fireball.maxActive }, () => {
    const group = new T.Group(), core = new T.Mesh(this.fireCoreGeometry, this.fireCoreMaterial);
    const glows = this.fireGlowMaterials.map((material, i) => { const glow = new T.Mesh(this.fireGlowGeometry, material); glow.scale.setScalar([.85, 1.35, 2.2][i]); return glow; });
    const flames = Array.from({ length: 7 }, () => new T.Mesh(this.flameGeometry, this.flameMaterial));
    const halo = new T.Mesh(new T.RingGeometry(EAT.hell.fireball.radius * 1.1, EAT.hell.fireball.radius * 2.1, 32), this.fireGlowMaterials[1]); halo.rotation.x = -Math.PI / 2;
    group.add(core, ...glows, ...flames, halo); group.visible = false; return { group, core, glows, flames, halo };
  });
  private emberMaterial = new T.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false });
  private embers = new T.InstancedMesh(this.particleGeometry, this.emberMaterial, EAT.hell.fireball.maxActive * 10);
  private transform = new T.Object3D();
  private color = new T.Color();
  constructor(scene: T.Scene) {
    this.lavaMaterial.onBeforeCompile = shader => {
      shader.uniforms.hellTime = this.clock;
      shader.vertexShader = 'varying vec2 lavaUV;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nlavaUV = position.xy / 80.0;');
      shader.fragmentShader = 'uniform float hellTime; varying vec2 lavaUV;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat flow = sin(lavaUV.x * 1.7 + sin(lavaUV.y * 2.1 + hellTime * .3)) * sin(lavaUV.y * 1.3 - hellTime * .2); totalEmissiveRadiance *= .45 + .65 * smoothstep(-.2, .6, flow); diffuseColor.rgb *= .55 + .45 * smoothstep(-.5, .7, flow);');
    };
    this.lava.rotation.x = -Math.PI / 2; this.lava.position.set(EAT.match.width / 2, -110, EAT.match.height / 2);
    this.laser.name = 'sweep-laser'; this.arrow.name = 'sweep-arrow';
    this.hole.scale.y = .2; this.rim.rotation.x = -Math.PI / 2;
    this.tiles.receiveShadow = true; this.tiles.frustumCulled = false;
    this.geyserParticles.frustumCulled=false; this.group.add(this.geyserParticles,...this.geyserCores,...this.geysers,...this.warnings,this.tiles, this.lava); this.particles.frustumCulled = false; for (const v of this.effects) this.group.add(v.hole,v.rim,v.path,...v.rings,v.particles,v.laser,v.arrow); this.embers.frustumCulled = false; this.group.add(this.embers, ...this.fireballs.map(f => f.group)); scene.add(this.group); this.group.visible = false;
  }
  cutMouths(holes: T.Vector3[]) {
    this.tileMaterial.onBeforeCompile = shader => {
      shader.uniforms.eatHoles = { value: holes };
      shader.vertexShader = 'varying vec3 eatWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\neatWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = 'uniform vec3 eatHoles[8]; varying vec3 eatWorld;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfor (int i = 0; i < 8; i++) { if (eatHoles[i].z > 0.0 && distance(eatWorld.xz, eatHoles[i].xy) < eatHoles[i].z) discard; }');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nvec2 tile = mod(eatWorld.xz, 80.0); float crack = abs(tile.x - 38.0 - sin(tile.y * .19) * 9.0); if (crack < 1.5 && vColor.r > .3) diffuseColor.rgb *= .25;');
    };
  }
  draw(s: GameState) {
    this.group.visible = !!s.hell; if (!s.hell) return;
    const H = EAT.hell, h = s.hell; this.clock.value = s.time;
    this.geysers.forEach((mesh,i)=>{
      const e=h.eruptions?.[i], warning=this.warnings[i]; mesh.visible=warning.visible=!!e; this.geyserCores[i].visible=!!e && s.time>=e.eruptAt;
      if (!e) return;
      const active=s.time>=e.eruptAt, pressure=Math.max(0,(s.time-e.warningAt)/H.eruptionWarning);
      const height=active ? 250+Math.sin(s.time*24)*40 : 8+pressure*28;
      mesh.position.set(e.x,height/2,e.y); mesh.scale.set(active?1:.15+pressure*.25,height,active?1:.15+pressure*.25); mesh.rotation.y=s.time*3;
      const core=this.geyserCores[i]; core.position.set(e.x,height*.55,e.y); core.scale.set(.38,height*1.1,.38);
      warning.position.set(e.x,3,e.y); warning.rotation.x=-Math.PI/2; warning.scale.setScalar(1+Math.sin(s.time*12)*.07);
    });
    for(let i=0;i<48;i++) {
      const e=h.eruptions?.[Math.floor(i/24)], active=e && s.time>=e.eruptAt, t=(s.time*(active?1.8:.8)+i*.618)%1;
      this.transform.position.set(e ? e.x+Math.cos(i*2.4)*H.eruptionRadius*.6*(1-t) : 0,e ? 8+t*(active?230:45) : 0,e ? e.y+Math.sin(i*2.4)*H.eruptionRadius*.6*(1-t) : 0);
      this.transform.scale.setScalar(e ? (active?2:1)*(1-t) : 0); this.transform.rotation.set(0,0,0);this.transform.updateMatrix();this.geyserParticles.setMatrixAt(i,this.transform.matrix);
    }
    this.geyserParticles.instanceMatrix.needsUpdate=true;
    h.cells.forEach((v, i) => {
      const at = cellCenter(i), phase = cellPhase(s, i), t = v > 0 ? Math.max(0, (s.time - v - H.warningDuration) / H.destructionDuration) : 0;
      this.transform.position.set(at.x, -12 - t * t * 100, at.y);
      this.transform.scale.setScalar(phase === 'destroyed' ? 0 : Math.max(.05, 1 - t * .7));
      this.transform.rotation.set(t * .25, 0, t * .2); this.transform.updateMatrix(); this.tiles.setMatrixAt(i, this.transform.matrix);
      this.color.set(phase === 'intact' ? ((i + Math.floor(i / H.columns)) % 2 ? '#302631' : '#392d37') : phase === 'warning' ? '#bd5631' : '#f39846');
      const eruption=h.eruptions?.find(e=>Math.hypot(at.x-e.x,at.y-e.y)<H.eruptionRadius);
      if (eruption && phase==='intact') this.color.set(s.time>=eruption.eruptAt ? '#ffab36' : Math.sin(s.time*12)>0 ? '#be542b' : '#713022');
      this.tiles.setColorAt(i, this.color);
    });
    this.tiles.instanceMatrix.needsUpdate = true; if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    this.lavaMaterial.emissiveIntensity = .8 + Math.sin(s.time * 1.8) * .12;
    const fires = h.fireballs ?? [];
    this.fireballs.forEach((v, i) => {
      const f = fires[i]; v.group.visible = !!f; if (!f) return;
      const t = s.time + f.id * .37, appear = Math.min(1, (s.time - f.spawnedAt) / .35), bob = 34 + Math.sin(t * 3.2) * 6;
      v.group.position.set(f.x, bob, f.y); v.group.scale.setScalar(appear * (1 + Math.sin(t * 7) * .06));
      v.core.rotation.set(t * 1.3, t * 2.1, 0);
      v.glows.forEach((glow, j) => glow.scale.setScalar([.85, 1.35, 2.2][j] * (1 + Math.sin(t * (9 + j * 3) + j) * .09)));
      v.flames.forEach((flame, j) => {
        const angle = j * Math.PI * 2 / 7 + t * 2.4, lick = .75 + .45 * Math.abs(Math.sin(t * 11 + j * 1.7));
        flame.position.set(Math.cos(angle) * 9, 14 + lick * 10, Math.sin(angle) * 9); flame.scale.set(.8, lick, .8); flame.rotation.set(Math.sin(angle) * .35, 0, -Math.cos(angle) * .35);
      });
      v.halo.position.y = 2 - bob; v.halo.scale.setScalar(1 + Math.sin(t * 5) * .12);
    });
    for (let i = 0; i < this.embers.count; i++) {
      const f = fires[Math.floor(i / 10)], k = (s.time * .9 + i * .618) % 1, angle = i * 2.4 + s.time;
      this.transform.position.set(f ? f.x + Math.cos(angle) * 14 * (1 - k) : 0, f ? 40 + k * 70 : -500, f ? f.y + Math.sin(angle) * 14 * (1 - k) : 0);
      this.transform.rotation.set(0, 0, 0); this.transform.scale.setScalar(f ? 1.4 * (1 - k) : 0); this.transform.updateMatrix(); this.embers.setMatrixAt(i, this.transform.matrix);
    }
    this.embers.instanceMatrix.needsUpdate = true;
    // A devoured hole stays visible briefly while it is sucked into its eater's mouth and shrinks away.
    const F = H.fireball, holes = allBlackHoles(s).filter(b => b.eatenAt === undefined || s.time - b.eatenAt < F.holeEatAnimation);
    this.effects.forEach((v,index)=> {
    const hole=holes[index]; for(const node of [v.hole,v.rim,v.path,...v.rings,v.particles,v.laser,v.arrow]) node.visible=!!hole; if(!hole)return;
    let b = hole, shrink = 1;
    if (hole.eatenAt !== undefined) {
      const eater = s.players.find(p => p.id === hole.eatenBy), t = Math.min(1, (s.time - hole.eatenAt) / F.holeEatAnimation), m = eater ? mouthPosition(eater, playerRadius(eater, s.time)) : hole;
      b = { ...hole, x: hole.x + (m.x - hole.x) * t * t, y: hole.y + (m.y - hole.y) * t * t, warnUntil: 0 }; shrink = 1 - t;
    }
    const grown = holeRadius(b) / H.radius * shrink; v.hole.position.set(b.x, 12, b.y); v.hole.scale.set(grown, .2 * grown, grown); v.rim.position.set(b.x, 18, b.y); v.rim.scale.setScalar(grown * (1 + Math.sin(s.time * 5) * .035));
    const warning = s.time < b.warnUntil, pulse = 1 + Math.sin(s.time*9)*.08;
    // Harmless sweeps (no floor damage) telegraph in a muted lilac instead of the alarm colour.
    v.laserMaterial.color.set(b.harmless ? '#a69bc4' : v.color); v.pathMaterial.color.set(b.harmless ? '#a69bc4' : v.color);
    const energy=b.speedCategory==='extreme'?2:b.speedCategory==='fast'?1.4:1;
    v.rimMaterial.color.set(b.speedCategory==='extreme' ? '#ffebe0' : warning ? '#ffab67' : '#b168ed');
    v.rings.forEach((ring,i)=>{ ring.position.set(b.x,16+i*4,b.y); ring.rotation.set(-Math.PI/2+Math.sin(s.time+i)*.08,Math.cos(s.time*.6+i)*.08,s.time*(i%2?-.4:.3)*energy); ring.scale.set((1.08+i*.14)*Math.max(.001,grown),(1.04+i*.12)*Math.max(.001,grown),1); });
    for(let i=0;i<40;i++) {
      const angle=i*Math.PI*2/40+s.time*(.35+i%3*.1), radius=holeRadius(b)*shrink*(1.12+(i%5)*.07);
      this.transform.position.set(b.x+Math.cos(angle)*radius,18+Math.sin(angle*3)*7,b.y+Math.sin(angle)*radius);
      this.transform.rotation.set(0,0,0); this.transform.scale.setScalar((warning?1.6:1)*energy*(1+i%3*.3)*shrink); this.transform.updateMatrix(); v.particles.setMatrixAt(i,this.transform.matrix);
    }
    v.particles.instanceMatrix.needsUpdate=true;
    const dx=b.destination.x-b.x, dy=b.destination.y-b.y, length=Math.hypot(dx,dy), direction=new T.Vector3(b.destination.x-(b.control?.x??b.x),0,b.destination.y-(b.control?.y??b.y)).normalize();
    v.laser.visible=warning && length>1 && !b.control; v.arrow.visible=warning && length>1;
    v.laser.position.set(b.x+dx*.5,25,b.y+dy*.5); v.laser.scale.set(6*pulse,2,Math.max(1,length-24)); v.laser.rotation.y=Math.atan2(dx,dy);
    v.arrow.position.set(b.destination.x,25,b.destination.y); v.arrow.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction); v.arrow.scale.setScalar(pulse);
    const key=[b.sweep,b.from.x,b.from.y,b.destination.x,b.destination.y,b.control?.x,b.control?.y].join(',');
    if(v.pathKey!==key){v.pathKey=key;const positions=v.pathGeometry.getAttribute('position');sweepPath(b).forEach((point,i)=>positions.setXYZ(i,point.x,25,point.y));positions.needsUpdate=true;v.path.computeLineDistances();v.pathGeometry.computeBoundingSphere();}
    v.path.visible = s.time < b.warnUntil;
    });
  }
  dispose() {
    this.fireballs.forEach(v => v.halo.geometry.dispose()); this.embers.dispose();
    for (const resource of [this.fireCoreGeometry, this.fireCoreMaterial, this.fireGlowGeometry, ...this.fireGlowMaterials, this.flameGeometry, this.flameMaterial, this.emberMaterial]) resource.dispose();
    this.effects.forEach(v=>{v.particles.dispose();v.rimMaterial.dispose();v.laserMaterial.dispose();v.pathGeometry.dispose();v.pathMaterial.dispose();});
    this.group.removeFromParent(); this.geyserParticles.dispose(); this.tiles.dispose(); this.particles.dispose(); this.rings.forEach(ring=>ring.material.dispose());
    for (const resource of [this.geyserGeometry,this.geyserMaterial,this.geyserCoreMaterial,this.warningGeometry,this.warningMaterial,this.particleGeometry, this.particleMaterial, this.laserGeometry, this.laserMaterial, this.arrowGeometry, this.tileGeometry, this.tileMaterial, this.lavaGeometry, this.lavaMaterial, this.holeGeometry, this.holeMaterial, this.rimGeometry, this.rimMaterial, this.pathGeometry, this.pathMaterial]) resource.dispose();
  }
}
