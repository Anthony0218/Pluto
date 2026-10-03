import { jumpHeight } from './abilities.ts';
import { spitPose } from './choking.ts';
import { burpAmount } from './expressions.ts';
import { powerVisual, questScale } from './scaling.ts';
import { HellVisuals } from './hellVisuals.ts';
import { blackHoles, cellCenter, cellPhase, safeGround, sweepPath } from './hell.ts';
import { ridePose } from './escape.ts';
import { QuestVisuals } from './questVisuals.ts';
import * as T from 'three';
import { ui } from '../../i18n/ui';
import { EAT, FOOD, playerRadius, cameraZoom } from './config.ts';
import { clamp, obstaclesFor, zoneRadius } from './maps.ts';
import { angleDelta, foodFits, eyeProportion, isChoking, MOUTH, mouthPosition } from './rules.ts';
import { fallOffset, fallPose, objectHeight } from './falling.ts';
import { ModelLibrary } from './models.ts';
import { background, POWER_COLOR, POWER_SYMBOL } from './terrain.ts';
import type { GameState, MapId, Player } from './types.ts';
export { POWER_SYMBOL } from './terrain.ts';

type Visual = { x: number; y: number; radius: number; facing: number; group: T.Group };
const UP = new T.Vector3(0, 1, 0);
const TILT = Math.PI / 3;
/** Screen-space plaque remains legible at every zoom. */
function notice(c: CanvasRenderingContext2D, text: string, x: number, y: number, accent = '#ffd287', size = 15) {
  c.save(); c.font = `900 ${size}px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`; c.textAlign = 'center';
  const w = c.measureText(text).width + 18;
  c.fillStyle = '#211b30e8'; c.strokeStyle = accent; c.lineWidth = 1.5;
  c.beginPath(); c.roundRect(x-w/2,y-size-5,w,size+13,8); c.fill(); c.stroke();
  c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = '#171324'; c.strokeText(text,x,y);
  c.fillStyle = '#fff6df'; c.fillText(text,x,y); c.restore();
}

/** Bounded Canvas shell: no screen-size shader, one gradient and six orbiting fragments per player. */
function drawShield(c: CanvasRenderingContext2D,x:number,y:number,r:number,time:number,remaining:number,hitAge:number) {
  c.save();
  const hit=Math.max(0,1-hitAge/.6), pulse=remaining<4 ? .65+.25*Math.sin(time*9) : .9;
  c.globalAlpha=pulse;
  const glow=c.createRadialGradient(x-r*.3,y-r*.35,r*.08,x,y,r);
  glow.addColorStop(0,'#e4fcff55');glow.addColorStop(.6,'#7edfff18');glow.addColorStop(.9,'#58bdff44');glow.addColorStop(1,hit?'#ffffffcc':'#b2f3ff88');
  c.fillStyle=glow;c.strokeStyle=hit?'#ffffff':'#a3eeff';c.lineWidth=2+hit*3;
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle='#e9ffffbb';c.lineWidth=3;c.beginPath();c.arc(x,y,r*.86,3.65,4.65);c.stroke();
  for(let i=0;i<6;i++) {
    const a=time*.35+i*Math.PI/3,px=x+Math.cos(a)*r*.91,py=y+Math.sin(a)*r*.91,size=Math.min(8,r*.12);
    c.beginPath();for(let j=0;j<6;j++){const t=j*Math.PI/3;c.lineTo(px+Math.cos(t)*size,py+Math.sin(t)*size);}c.closePath();c.lineWidth=1;c.stroke();
  }
  if(hit>0){c.globalAlpha=hit;c.lineWidth=3;c.beginPath();c.arc(x,y,r*(1-hit*.65),0,Math.PI*2);c.stroke();}
  c.restore();
}

export class ArenaRenderer {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private hellVisuals = new HellVisuals(this.scene);
  private ground: T.Mesh;
  // Far back along the tilt so a zoomed-out ortho view never clips the ground near the screen edges.
  private camera = new T.OrthographicCamera(-500, 500, 400, -400, 1, 9000);
  private library = new ModelLibrary();
  private questVisuals = new QuestVisuals(this.scene, this.library);
  private terrain: HTMLCanvasElement;
  private overlay = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private groundTexture: T.CanvasTexture;
  private groundMaterial: T.MeshStandardMaterial;
  private groundGeometry = new T.PlaneGeometry(EAT.match.width, EAT.match.height);
  private pitGeometry = new T.CylinderGeometry(1, 1, 650, 48, 1, true);
  private pitMaterial = new T.MeshBasicMaterial({ color: '#182330', side: T.BackSide });
  private bottomGeometry = new T.CircleGeometry(1, 48);
  private bottomMaterial = new T.MeshBasicMaterial({ color: '#090f1a', side: T.DoubleSide });
  private holes = Array.from({ length: 8 }, () => new T.Vector3(0, 0, 0));
  private visuals = new Map<string, Visual>();
  private props = new Map<number, T.Group>();
  private powers = new Map<number, T.Group>();
  private resources: (T.BufferGeometry | T.Material)[] = [];
  private sun = new T.DirectionalLight('#fff2d6', 2.6);
  private focus = { x: EAT.match.width / 2, y: EAT.match.height / 2, zoom: 1.1, initialized: false };
  /** Player zoom (wheel, pinch, +/-) multiplies the size-based automatic zoom. */
  private userZoom = { target: 1, shown: 1 };
  private shadowExtent = { x: 1300, y: 1100 };
  private width = 1;
  private height = 1;
  private dpr = 1;
  private projected = new T.Vector3();
  private axis = new T.Vector3();
  private tilt = new T.Quaternion();
  private yaw = new T.Quaternion();
  private contextLost = false;
  private onLost = (e: Event) => { e.preventDefault(); this.contextLost = true; };
  private onRestored = () => { this.contextLost = false; };

  constructor(canvas: HTMLCanvasElement, map: MapId) {
    this.hellVisuals.cutMouths(this.holes);
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(map === 'nature' ? '#819b77' : '#a8b7b3');
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.scene.add(new T.HemisphereLight('#e6f4ff', '#8f9b78', 2.2));
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -1300, right: 1300, top: 1100, bottom: -1100, near: 10, far: 7800 });
    this.sun.shadow.bias = -.0002; this.sun.shadow.normalBias = 1.2;
    this.scene.add(this.sun, this.sun.target);
    this.terrain = background(map); this.groundTexture = new T.CanvasTexture(this.terrain);
    this.groundTexture.colorSpace = T.SRGBColorSpace; this.groundTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.groundMaterial = new T.MeshStandardMaterial({ map: this.groundTexture, roughness: 1 });
    // Actual holes in the ground's color AND depth coverage. Above-ground parts
    // remain visible across the rim; the floor occludes parts below it naturally.
    this.groundMaterial.onBeforeCompile = shader => {
      shader.uniforms.eatHoles = { value: this.holes };
      shader.vertexShader = 'varying vec3 eatWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\neatWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = 'uniform vec3 eatHoles[8];\nvarying vec3 eatWorld;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfor (int i = 0; i < 8; i++) { if (eatHoles[i].z > 0.0 && distance(eatWorld.xz, eatHoles[i].xy) < eatHoles[i].z) discard; }');
    };
    const ground = this.ground = new T.Mesh(this.groundGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2; ground.position.set(EAT.match.width / 2, 0, EAT.match.height / 2); ground.receiveShadow = true; this.scene.add(ground);
    this.scenery(map);
    this.overlay.className = 'eat-3d-overlay'; this.overlay.setAttribute('aria-hidden', 'true');
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    canvas.insertAdjacentElement('afterend', this.overlay); this.ctx = this.overlay.getContext('2d')!;
    canvas.addEventListener('webglcontextlost', this.onLost); canvas.addEventListener('webglcontextrestored', this.onRestored);
  }
  private scenery(map: MapId) {
    for (const o of obstaclesFor(map)) {
      if (o.kind === 'water') continue;
      const kind = o.kind === 'stall' ? 'kiosk' : o.kind === 'planter' ? 'plantPot' : o.kind === 'rock' ? 'stone' : o.kind === 'crate' ? 'barrel' : o.kind === 'fountain' ? null : o.kind;
      let group: T.Group;
      if (kind) {
        group = this.library.prop(kind); group.scale.set(o.w / FOOD[kind].width, o.kind === 'rock' ? 3 : 1, o.h / FOOD[kind].height);
      } else {
        group = new T.Group();
        this.library.part(group, 'cylinder', '#b3bdb8', 0, 9, 0, o.w / 2, 18, o.h / 2);
        this.library.part(group, 'cylinder', '#89c4cc', 0, 19, 0, o.w * .43, 2, o.h * .43);
        this.library.part(group, 'cylinder', '#e0ddc6', 0, 34, 0, 12, 40, 12);
        this.library.part(group, 'ball', '#aee4e2', 0, 57, 0, 20, 7, 20);
      }
      group.position.set(o.x + o.w / 2, 0, o.y + o.h / 2); this.scene.add(group);
    }
  }
  resize(width: number, height: number) {
    this.width = Math.max(1, width); this.height = Math.max(1, height); this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(this.width, this.height, false);
    this.overlay.width = Math.round(this.width * this.dpr); this.overlay.height = Math.round(this.height * this.dpr);
  }
  private player(p: Player) {
    const group = new T.Group(), r = 1;
    const ring = new T.Mesh(new T.TorusGeometry(.91, .09, 10, 64), this.library.material(p.color));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .035; group.add(ring); this.resources.push(ring.geometry);
    const wall = new T.Mesh(this.pitGeometry, this.pitMaterial); wall.scale.set(MOUTH.radius, 1, MOUTH.radius); wall.position.y = -325; group.add(wall);
    const bottom = new T.Mesh(this.bottomGeometry, this.bottomMaterial); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -649; bottom.scale.setScalar(MOUTH.radius); group.add(bottom);
    // Two small, asymmetric stalk eyes give the ring a custom creature identity.
    for (const side of [-1, 1]) {
      const eye = new T.Group(); eye.name = 'eye'; eye.position.set(-r * .88, .14, side * .37);
      this.library.part(eye, 'ball', '#fff7df', 0, 0, 0, 1, 1.25, 1);
      this.library.part(eye, 'ball', '#253346', .25, 1.10, .12, .43, .18, .55);
      this.library.part(eye, 'ball', '#ffffff', .36, 1.28, -.08, .13, .06, .15);
      group.add(eye);
    }
    this.scene.add(group); return group;
  }
  zoomBy(factor: number) {
    this.userZoom.target = clamp(this.userZoom.target * factor, EAT.camera.minUserZoom, EAT.camera.maxUserZoom);
    return this.userZoom.target;
  }
  get zoomLevel() { return this.userZoom.target; }
  private project(x: number, y: number, z = 0) {
    this.projected.set(x, z, y).project(this.camera);
    return { x: (this.projected.x + 1) * this.width / 2, y: (1 - this.projected.y) * this.height / 2 };
  }
  draw(state: GameState, localId: string, dt: number, you: string, debug: boolean, networked = false) {
    if (this.contextLost) {
      const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.width, this.height);
      c.fillStyle = '#152531'; c.fillRect(0, this.height / 2 - 30, this.width, 60); c.fillStyle = '#fff'; c.font = '16px system-ui'; c.textAlign = 'center'; c.fillText(ui('Restoring 3D graphics…'), this.width / 2, this.height / 2); return;
    }
    this.ground.visible = !state.hell; this.hellVisuals.draw(state);
    this.renderer.setClearColor(state.hell ? '#170e1c' : state.map === 'nature' ? '#819b77' : '#a8b7b3');
    const smooth = 1 - Math.exp(-Math.max(dt, .001) * EAT.camera.growthRate);
    const local = state.players.find(p => p.id === localId);
    const followed = local?.alive ? local : state.players.filter(p => p.alive).sort((a, b) => b.mass - a.mass)[0] ?? local;
    this.holes.forEach(h => h.set(0, 0, 0));
    state.players.forEach((p, i) => {
      let v = this.visuals.get(p.id);
      if (!v) { v = { x: p.x, y: p.y, radius: playerRadius(p, state.time), facing: p.facing, group: this.player(p) }; this.visuals.set(p.id, v); }
      const movement = networked && p.id !== localId ? 1 : 1 - Math.exp(-dt * 18);
      v.x += (p.x - v.x) * movement; v.y += (p.y - v.y) * movement;
      v.facing += angleDelta(v.facing, p.facing) * smooth; v.radius = playerRadius(p, state.time); // The rendered opening and authoritative tree fit share exactly one radius.
      v.group.visible = p.alive;
      const m = mouthPosition({ ...p, x: v.x, y: v.y, facing: v.facing }, v.radius);
      const ride = ridePose(state, p), falling = p.fallingAt === undefined ? 0 : clamp((state.time - p.fallingAt) / EAT.hell.fallDuration, 0, 1);
      v.group.position.set(m.x, p.escape && ride.mounted ? ride.altitude + ride.scale * (p.escape.kind === 'cat' ? 38 : 30) : jumpHeight(p,state.time)-falling * falling * 180, m.y); v.group.rotation.y = -v.facing;
      // Vertical pit depth stays fixed; only the rim and eyes grow vertically.
      v.group.scale.setScalar(v.radius * (1 - falling * .8));
      const stunned = (p.stunnedUntil ?? 0) > state.time, choking = isChoking(p, state.time) || stunned, burp = burpAmount(state, p);
      const blackHole = blackHoles(state).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0], nervous = !!state.hell && !safeGround(state, p);
      const fear = blackHole ? clamp(1 - Math.hypot(p.x-blackHole.x,p.y-blackHole.y)/600, 0, 1) : 0;
      for (const eye of v.group.children) if (eye.name === 'eye') {
        eye.scale.set(eyeProportion(v.radius), eyeProportion(v.radius) * (choking ? 1.4 : blackHole ? 1.25 + fear*.3 : 1 + burp*.18), eyeProportion(v.radius));
        const a = blackHole ? Math.atan2(blackHole.y-p.y,blackHole.x-p.x)-v.facing : 0;
        eye.children[1].position.x = blackHole ? Math.cos(a)*.4 : .25;
        eye.children[1].position.z = blackHole ? Math.sin(a)*.4 : .12;
        eye.children[2].position.x = eye.children[1].position.x+.1;
        eye.children[2].position.z = eye.children[1].position.z-.2;
      }
      const coughAge=state.time-(p.chokingUntil??-100), cough=(p.chokingUntil??0)>0 && coughAge>=0 && coughAge<.27 ? Math.sin(coughAge/.27*Math.PI) : 0;
      const rim = v.group.children[0], strike = p.ability?.kind==='strike' ? Math.sin(Math.min(1,(state.time-p.ability.startedAt)/EAT.powerups.strike.burstDuration)*Math.PI) : 0;
      rim.scale.set(1 + (choking ? Math.sin(state.time * 28) * .07 : burp*.045), 1 - (choking ? Math.sin(state.time * 28) * .07 : -burp*.045), 1 + burp*.25 + strike*.18-cough*.22);
      if (nervous) v.group.rotation.y += Math.sin(state.time*25)*.018;
      if (choking) v.group.rotation.y += Math.sin(state.time * 32) * .055;
      const wall = v.group.children[1], bottom = v.group.children[2];
      wall.visible = !state.hell && !p.escape && p.fallingAt === undefined; bottom.visible = true;
      if (p.escape || p.fallingAt !== undefined) { bottom.position.y = -.02; }
      wall.scale.y = 1 / v.radius; wall.position.y = -325 / v.radius;
      bottom.position.y = p.escape || p.fallingAt !== undefined || state.hell ? -.02 : -649 / v.radius;
      if (p.alive && !p.escape && p.ability?.kind !== 'jump' && p.fallingAt === undefined && i < 8) this.holes[i].set(m.x, m.y, v.radius * MOUTH.radius);
      if (!p.alive && p.eliminatedAt !== null) {
        const age = state.time - p.eliminatedAt;
        const attacker = state.players.find(other => other.id === p.eliminatedBy);
        if (attacker && age >= 0 && age < EAT.eating.playerAnimation) {
          const t = age / EAT.eating.playerAnimation, mouth = mouthPosition(attacker, playerRadius(attacker, state.time));
          v.group.visible = true;
          v.group.position.set(m.x + (mouth.x - m.x) * t, -v.radius * 2 * t * t, m.y + (mouth.y - m.y) * t);
          v.group.scale.setScalar(v.radius * (1 - t));
        }
      }
    });
    if (followed) {
      const v = this.visuals.get(followed.id)!;
      if (!this.focus.initialized) { this.focus.x = v.x; this.focus.y = v.y; this.focus.initialized = true; }
      const follow = 1 - Math.exp(-EAT.camera.followRate * dt);
      this.focus.x += (v.x - this.focus.x) * follow; this.focus.y += (v.y - this.focus.y) * follow;
      const zoom = cameraZoom(followed.mass);
      this.focus.zoom += (zoom - this.focus.zoom) * follow;
    }
    this.userZoom.shown += (this.userZoom.target - this.userZoom.shown) * (1 - Math.exp(-14 * dt));
    const zoom = (state.hell ? Math.min(1, this.width / 1400, this.height / (1100 * Math.sin(TILT))) : this.focus.zoom * Math.min(1, this.width / 700 + .36)) * this.userZoom.shown;
    const halfW = this.width / zoom / 2, halfH = this.height / zoom / 2;
    const groundHalfH = halfH / Math.sin(TILT);
    // Shadows cover the whole view when zoomed out; resized only on real changes.
    const shadowX = Math.max(1300, Math.ceil((halfW + 300) / 200) * 200), shadowY = Math.max(1100, Math.ceil((groundHalfH + 300) / 200) * 200);
    if (shadowX !== this.shadowExtent.x || shadowY !== this.shadowExtent.y) {
      this.shadowExtent = { x: shadowX, y: shadowY };
      Object.assign(this.sun.shadow.camera, { left: -shadowX, right: shadowX, top: shadowY, bottom: -shadowY, far: 5400 + shadowX + shadowY });
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    this.focus.x = halfW < EAT.match.width / 2 ? clamp(this.focus.x, halfW, EAT.match.width - halfW) : EAT.match.width / 2;
    this.focus.y = groundHalfH < EAT.match.height / 2 ? clamp(this.focus.y, groundHalfH, EAT.match.height - groundHalfH) : EAT.match.height / 2;
    if (state.hell) {
      const H=EAT.hell, centerX=H.left+H.columns*H.cellSize/2, centerY=H.top+H.rows*H.cellSize/2;
      this.focus.x=halfW < H.columns*H.cellSize/2+120 ? clamp(this.focus.x,H.left-120+halfW,H.left+H.columns*H.cellSize+120-halfW) : centerX;
      this.focus.y=groundHalfH < H.rows*H.cellSize/2+120 ? clamp(this.focus.y,H.top-120+groundHalfH,H.top+H.rows*H.cellSize+120-groundHalfH) : centerY;
    }
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.position.set(this.focus.x, 4000 * Math.sin(TILT), this.focus.y + 4000 * Math.cos(TILT));
    this.camera.lookAt(this.focus.x, 0, this.focus.y); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    // Same light direction, placed far enough back that a zoomed-out shadow box stays in front of it.
    this.sun.position.set(this.focus.x - 1950, 4500, this.focus.y - 2100); this.sun.target.position.set(this.focus.x, 0, this.focus.y);
    const present = new Set<number>();
    for (const f of state.food) {
      present.add(f.id); let group = this.props.get(f.id);
      if (!group) { group = this.library.prop(f.kind); this.props.set(f.id, group); this.scene.add(group); }
      let x = f.x, y = f.y, z = f.z;
      const owner = f.target ? state.players.find(p => p.id === f.target && p.alive) : undefined;
      this.yaw.setFromAxisAngle(UP, -f.rotation); group.quaternion.copy(this.yaw);
      if (owner) {
        const v = this.visuals.get(owner.id)!;
        const age = Math.max(0, state.time - f.capturedAt), offset = fallOffset(f, age + 1 / EAT.network.tickRate);
        const pose = fallPose(f, age + 1 / EAT.network.tickRate);
        x = v.x + offset.x + (f.fallX ?? 0) * pose.shift;
        y = v.y + offset.y + (f.fallY ?? 0) * pose.shift;
        z = pose.z;
        this.axis.set(f.fallY ?? 0, 0, -(f.fallX ?? 0));
        if (this.axis.lengthSq() > .001) { this.axis.normalize(); this.tilt.setFromAxisAngle(this.axis, pose.angle); group.quaternion.premultiply(this.tilt); }
      }
      if (f.stuck) {
        const stuckOwner = this.visuals.get(f.stuck.playerId), wedged = f.stuck.age !== undefined;
        if (stuckOwner && wedged) {
          // Bridging the opening: frozen at the lean where its top hit the far rim, rocking as the eater strains.
          const offset = fallOffset(f, f.stuck.age!), pose = fallPose(f, f.stuck.age!);
          x = stuckOwner.x + offset.x + (f.fallX ?? 0) * pose.shift; y = stuckOwner.y + offset.y + (f.fallY ?? 0) * pose.shift; z = pose.z;
          this.axis.set(f.fallY ?? 0, 0, -(f.fallX ?? 0));
          if (this.axis.lengthSq() > .001) { this.axis.normalize(); this.tilt.setFromAxisAngle(this.axis, pose.angle + Math.sin(state.time * 22) * .035); group.quaternion.premultiply(this.tilt); }
        } else {
          if (stuckOwner) { const p = state.players.find(p=>p.id===f.stuck!.playerId)!; const m = mouthPosition({ ...p, x: stuckOwner.x, y: stuckOwner.y }, stuckOwner.radius); x=m.x; y=m.y; }
          const facing = state.players.find(p=>p.id===f.stuck!.playerId)?.facing ?? 0;
          this.axis.set(Math.sin(facing),0,-Math.cos(facing));
          this.tilt.setFromAxisAngle(this.axis,Math.sin(state.time*28)*.025); group.quaternion.premultiply(this.tilt);
        }
      } else if (f.spit) {
        const pose = spitPose(f,state.time);
        if (pose.lean) { this.axis.set(f.fallY ?? 0, 0, -(f.fallX ?? 0)); if (this.axis.lengthSq() > .001) { this.axis.normalize(); this.tilt.setFromAxisAngle(this.axis, pose.lean); group.quaternion.premultiply(this.tilt); } }
        this.axis.set(f.spit.destination.y-f.spit.origin.y,0,-(f.spit.destination.x-f.spit.origin.x)).normalize();
        this.tilt.setFromAxisAngle(this.axis,pose.tilt); group.quaternion.premultiply(this.tilt);
      }
      group.position.set(x, z, y);
      if (FOOD[f.kind].shape === 'pluto') group.traverse(child => { if (child instanceof T.Mesh && child.material instanceof T.MeshStandardMaterial && child.material.emissive.getHex() !== 0) child.material.emissiveIntensity = .5 + Math.sin(state.time * 2) * .12; });
      group.visible = Math.abs(x - this.focus.x) < halfW + FOOD[f.kind].radius + 220 && Math.abs(y - this.focus.y) < groundHalfH + objectHeight(f.kind) + 220;
      group.traverse(child => { if (child instanceof T.Mesh) child.castShadow = !owner; });
    }
    for (const [id, group] of this.props) if (!present.has(id)) { this.scene.remove(group); this.props.delete(id); }
    const powers = new Set(state.powerups.map(p => p.id));
    for (const [id, group] of this.powers) if (!powers.has(id)) { this.scene.remove(group); this.powers.delete(id); }
    for (const p of state.powerups) {
      let group = this.powers.get(p.id);
      if (!group) { group = new T.Group(); this.powers.set(p.id, group); this.scene.add(group); }
      const scale = powerVisual(followed ? playerRadius(followed, state.time) : 24).scale; group.scale.setScalar(scale);
      group.position.set(p.x, 23 * scale + Math.sin(state.time * 3 + p.id) * 4, p.y); group.rotation.y = state.time * .7;
    }
    this.questVisuals.draw(state, followed ? playerRadius(followed, state.time) : 24);
    this.renderer.render(this.scene, this.camera);
    this.labels(state, localId, you, debug);
  }
  private labels(state: GameState, localId: string, you: string, debug: boolean) {
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.width, this.height);
    c.textAlign = 'center';
    const local = state.players.find(p => p.id === localId);
    for (const p of state.players) {
      if (!p.alive) continue;
      const v = this.visuals.get(p.id)!, ride = ridePose(state, p), screen = this.project(v.x, v.y - v.radius, p.escape && ride.mounted ? ride.altitude + ride.scale * 42 : 16+jumpHeight(p,state.time));
      c.font = '600 12px system-ui'; const label = p.id === localId ? p.name === you ? you : `${p.name} · ${you}` : p.name;
      const w = c.measureText(label).width + 18;
      c.fillStyle = '#24383cdd'; c.beginPath(); c.roundRect(screen.x - w / 2, screen.y - 20, w, 22, 7); c.fill();
      c.fillStyle = '#fff9e9'; c.fillText(label, screen.x, screen.y - 5);
      if ((p.stunnedUntil ?? 0) > state.time) { notice(c, ui('Stunned'), screen.x, screen.y-36, '#ffca72'); c.font='bold 20px system-ui'; c.fillStyle='#ffe8a4'; c.fillText('✦  ✧  ✦', screen.x+Math.sin(state.time*16)*5,screen.y-58); }
      if (isChoking(p, state.time)) notice(c, ui('Choking…'), screen.x + Math.sin(state.time*28)*1.5, screen.y - 33, '#ff885f');
      if(p.ability?.kind==='strike') {
        c.strokeStyle='#ffbc79bb';c.lineWidth=3;
        for(const side of [-1,0,1]) {const a=this.project(v.x-Math.cos(p.facing)*(v.radius+30)+Math.sin(p.facing)*side*v.radius*.55,v.y-Math.sin(p.facing)*(v.radius+30)-Math.cos(p.facing)*side*v.radius*.55,5),b=this.project(v.x-Math.cos(p.facing)*v.radius+Math.sin(p.facing)*side*v.radius*.55,v.y-Math.sin(p.facing)*v.radius-Math.cos(p.facing)*side*v.radius*.55,5);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
      }
      const burp = burpAmount(state,p);
      if (burp > 0) {
        const at=this.project(v.x,v.y,18+burp*24), size=8+burp*14;
        c.fillStyle='#e8ffb599'; c.strokeStyle='#fff6df'; c.lineWidth=2;
        for(let i=0;i<3;i++){ c.beginPath(); c.arc(at.x+(i-1)*size,at.y-i*size*.6,size*(1-i*.2),0,Math.PI*2); c.fill(); c.stroke(); }
      }
      if (p.effects.shield > state.time) {
        const at=this.project(v.x,v.y,0), edge=this.project(v.x+v.radius*1.18,v.y,0), radius=Math.max(4,edge.x-at.x);
        drawShield(c,at.x,at.y-radius*.12,radius,state.time,p.effects.shield-state.time,state.time-(p.shieldHitAt??-10));
      }
      if (p.effects.magnet > state.time || p.effects.speed > state.time || p.effects.multiplier > state.time) {
        const position = this.project(v.x, v.y, 0), edge = this.project(v.x + v.radius + 6, v.y, 0);
        c.strokeStyle = p.effects.magnet > state.time ? '#d497ed' : '#ffde8d'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(position.x, position.y, edge.x - position.x, (edge.x - position.x) * Math.sin(TILT), 0, 0, Math.PI * 2); c.stroke();
      }
      if (local?.alive && p.id !== localId) {
        const danger = playerRadius(p, state.time) >= playerRadius(local, state.time) * EAT.eating.playerEatRadiusRatio;
        const edible = playerRadius(local, state.time) >= playerRadius(p, state.time) * EAT.eating.playerEatRadiusRatio;
        if (danger || edible) { c.fillStyle = danger ? '#a84441' : '#496f4e'; c.font = 'bold 15px system-ui'; c.fillText(danger ? '!' : '↓', screen.x + w / 2 + 12, screen.y - 5); }
      }
      if (debug) {
        const at = this.project(v.x, v.y), edge = this.project(v.x + v.radius, v.y), radius = edge.x - at.x;
        const mouth = mouthPosition({ ...p, x: v.x, y: v.y, facing: v.facing }, v.radius), m = this.project(mouth.x, mouth.y);
        c.lineWidth = 1; c.strokeStyle = '#087bbc'; c.beginPath(); c.ellipse(at.x, at.y, radius, radius * Math.sin(TILT), 0, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#dd3752'; c.beginPath(); c.ellipse(m.x, m.y, radius * MOUTH.radius, radius * MOUTH.radius * Math.sin(TILT), 0, 0, Math.PI * 2); c.stroke();
        const facing = this.project(v.x + Math.cos(v.facing) * (v.radius + 50), v.y + Math.sin(v.facing) * (v.radius + 50));
        const velocity = this.project(v.x + p.vx * .4, v.y + p.vy * .4);
        c.beginPath(); c.moveTo(at.x, at.y); c.lineTo(facing.x, facing.y); c.stroke();
        c.strokeStyle = '#643ecc'; c.beginPath(); c.moveTo(at.x, at.y); c.lineTo(velocity.x, velocity.y); c.stroke();
        c.fillStyle = '#263e36'; c.fillText(`${p.botState} · r≥${(v.radius * EAT.eating.playerEatRadiusRatio).toFixed(1)}`, screen.x, screen.y - 27);
      }
    }
    if (local?.alive) for (const f of state.food) {
      if (f.target || foodFits(local, f, state.time) || Math.hypot(f.x - local.x, f.y - local.y) > 135 + FOOD[f.kind].radius) continue;
      const at = this.project(f.x, f.y, objectHeight(f.kind) + 12);
      c.fillStyle = '#786d5d'; c.font = 'bold 12px system-ui'; c.fillText('+', at.x, at.y);
    }
    const encounter = state.encounter;
    if (encounter && encounter.item.status === 'ground') {
      const scale = questScale(local ? playerRadius(local,state.time) : 24);
      const at = this.project(encounter.item.x, encounter.item.y, 42 * scale);
      notice(c,ui(encounter.item.kind === 'scroll' ? 'Golden Scroll' : 'Cat Tree'),at.x,at.y,'#ffdb78',12);
    }
    for (const event of state.events.filter(e => e.playerId === localId && (e.type === 'growth' || e.type === 'growthActive' || e.type === 'power' && e.power === 'divider')).slice(-6)) {
      const age = state.time-event.at; if (age < 0 || age > 1.4) continue;
      const p = state.players.find(p => p.id === event.playerId); if (!p) continue;
      const at = this.project(p.x,p.y,60), lane = event.id%3;
      const text = event.type === 'growth' ? `${(event.amount ?? 0)>=0 ? '+' : ''}${Number((event.amount ?? 0).toFixed(2))}` : ui(event.type === 'growthActive' ? '2x ACTIVE!' : 'Growth /2');
      c.save(); c.globalAlpha = Math.min(1,(1.4-age)*2); c.translate(at.x+(lane-1)*48,at.y-35-age*55-lane*18); c.rotate((lane-1)*.06);
      c.font = '900 23px ui-rounded, system-ui'; c.strokeStyle='#22362e'; c.lineWidth=5; c.strokeText(text,0,0); c.fillStyle=event.power==='divider' || (event.amount ?? 0)<0 ? '#ff8b64' : '#c8ff83'; c.fillText(text,0,0); c.restore();
    }
    for (const event of state.events) {
      const age = state.time - event.at;
      if (age < 0 || age > .65) continue;
      const p = state.players.find(p => p.id === event.playerId);
      if (!p) continue;
      const at = this.project(p.x, p.y, 28);
      if (event.type === 'lava') { c.strokeStyle = '#ffbe58'; c.lineWidth = 5 * (1 - age); c.beginPath(); c.ellipse(at.x, at.y + 25, 15 + age * 70, 8 + age * 35, 0, 0, Math.PI * 2); c.stroke(); }
      if (event.type === 'npcAttack' || event.type === 'choke') {
        c.strokeStyle = event.type === 'npcAttack' ? '#df574d' : '#f1e4c3'; c.lineWidth = 3;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(at.x - 13 + i * 10, at.y - 14 - age * 20); c.lineTo(at.x - 23 + i * 10, at.y + 10 - age * 20); c.stroke(); }
        if (event.type === 'npcAttack') { c.fillStyle = '#ac3736'; c.fillText(ui('Stunned'), at.x, at.y - 30 - age * 30); }
      }

    }
    for (const p of state.powerups) {
      const viewer = local?.alive ? local : state.players.find(p=>p.alive), visual = powerVisual(viewer ? playerRadius(viewer,state.time) : 24);
      const at = this.project(p.x, p.y, 35*visual.scale), glow=visual.glow;
      if (at.x < -glow || at.y < -glow || at.x > this.width+glow || at.y > this.height+glow) continue;
      const gradient=c.createRadialGradient(at.x,at.y,2,at.x,at.y,glow);
      gradient.addColorStop(0,POWER_COLOR[p.kind]+'aa'); gradient.addColorStop(1,POWER_COLOR[p.kind]+'00');
      c.save(); c.globalAlpha=visual.intensity/.394; c.fillStyle=gradient; c.beginPath(); c.arc(at.x,at.y,glow,0,Math.PI*2); c.fill(); c.restore();
      notice(c,POWER_SYMBOL[p.kind],at.x,at.y,POWER_COLOR[p.kind],visual.indicator);
    }
    if (state.hell && state.time >= state.hell.readyAt + EAT.hell.collapseAfter) notice(c,ui('The floor is collapsing!'),this.width/2,122,'#ffae5c',14);
    for (const [index,b] of blackHoles(state).entries()) if (state.time < b.warnUntil) {
      const color=b.harmless ? '#a69bc4' : ['#ff5366','#ff994c','#dc77f5'][index], from=this.project(b.x,b.y,26), to=this.project(b.destination.x,b.destination.y,26);
      const penultimate=sweepPath(b).at(-2)!, tail=this.project(penultimate.x,penultimate.y,26);
      const angle=Math.atan2(to.y-tail.y,to.x-tail.x), pulse=.8+Math.sin(state.time*9)*.15;
      c.save(); c.globalAlpha=pulse; c.shadowColor=color; c.shadowBlur=8; c.strokeStyle=color; c.lineWidth=5;
      c.beginPath(); c.moveTo(from.x,from.y); for (const point of sweepPath(b).slice(1)) { const screen=this.project(point.x,point.y,26); c.lineTo(screen.x,screen.y); } c.stroke();
      c.shadowBlur=0; c.strokeStyle='#fff0cc'; c.lineWidth=1.5; c.stroke();
      c.fillStyle='#ffad87'; c.beginPath(); c.moveTo(to.x,to.y); c.lineTo(to.x-Math.cos(angle-.45)*19,to.y-Math.sin(angle-.45)*19); c.lineTo(to.x-Math.cos(angle+.45)*19,to.y-Math.sin(angle+.45)*19); c.closePath(); c.fill(); c.restore();
      if (!b.harmless && !blackHoles(state).slice(0,index).some(other=>!other.harmless && state.time<other.warnUntil)) notice(c,ui('Black hole incoming!'),this.width/2,92,'#ff665e',16);
    }
    if (!state.settings?.matchDuration && !state.settings?.hellEnabled && !state.hell && state.time >= EAT.match.zoneStart) {
      const at = this.project(EAT.match.width / 2, EAT.match.height / 2), edge = this.project(EAT.match.width / 2 + zoneRadius(state.time), EAT.match.height / 2), r = edge.x - at.x;
      c.strokeStyle = '#cc6c69'; c.lineWidth = 4; c.setLineDash([12, 10]); c.beginPath(); c.ellipse(at.x, at.y, Math.max(0, r), Math.max(0, r * Math.sin(TILT)), 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    if (this.width >= 600) {
      const w = 144, h = w * EAT.match.height / EAT.match.width, x = this.width - w - 20, y = this.height - h - 20;
      c.fillStyle = '#23352bdd'; c.beginPath(); c.roundRect(x - 7, y - 7, w + 14, h + 14, 13); c.fill();
      if (state.hell) {
        c.fillStyle = '#bc3b18'; c.fillRect(x, y, w, h);
        state.hell.cells.forEach((_, i) => { if (cellPhase(state, i) === 'destroyed') return; const at = cellCenter(i); c.fillStyle = cellPhase(state, i) === 'intact' ? '#42333f' : '#ed9159'; c.fillRect(x + (at.x - 40) / EAT.match.width * w, y + (at.y - 40) / EAT.match.height * h, 80 / EAT.match.width * w, 80 / EAT.match.height * h); });
        for (const f of state.hell.fireballs ?? []) { c.fillStyle='#ffc93d'; c.beginPath(); c.arc(x+f.x/EAT.match.width*w,y+f.y/EAT.match.height*h,2.5,0,Math.PI*2); c.fill(); }
        for(const [i,b] of blackHoles(state).entries()) {
          c.fillStyle=['#ff5366','#ff994c','#dc77f5'][i];c.beginPath();c.arc(x+b.x/EAT.match.width*w,y+b.y/EAT.match.height*h,3.5,0,Math.PI*2);c.fill();
          if(state.time<b.warnUntil){c.strokeStyle=c.fillStyle;c.lineWidth=1;c.beginPath();sweepPath(b).forEach((at,j)=>{const px=x+at.x/EAT.match.width*w,py=y+at.y/EAT.match.height*h;if(j)c.lineTo(px,py);else c.moveTo(px,py);});c.stroke();}
        }
      } else c.drawImage(this.terrain, x, y, w, h);
      for (const p of state.players.filter(p => p.alive)) { c.beginPath(); c.arc(x + p.x / EAT.match.width * w, y + p.y / EAT.match.height * h, p.id === localId ? 4 : 3, 0, Math.PI * 2); c.fillStyle = p.color; c.fill(); c.strokeStyle = '#304b47'; c.lineWidth = 1; c.stroke(); }
      if (encounter) {
        if (encounter.item.status === 'ground') { c.fillStyle = '#ffdc73'; c.fillRect(x + encounter.item.x / EAT.match.width * w - 2, y + encounter.item.y / EAT.match.height * h - 2, 4, 4); }
        if (encounter.npc.phase !== 'gone' && encounter.npc.phase !== 'leaving' && encounter.npc.phase !== 'devoured') { c.fillStyle = encounter.npc.phase === 'hostile' ? '#e64f4f' : '#a97cdf'; c.beginPath(); c.arc(x + encounter.npc.x / EAT.match.width * w, y + encounter.npc.y / EAT.match.height * h, 3, 0, Math.PI * 2); c.fill(); }
      }
      if (!state.settings?.matchDuration && !state.settings?.hellEnabled && !state.hell && state.time >= EAT.match.zoneStart) { c.beginPath(); c.arc(x + w / 2, y + h / 2, zoneRadius(state.time) / EAT.match.width * w, 0, Math.PI * 2); c.strokeStyle = '#bf5555'; c.stroke(); }
    }
  }
  dispose() {
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost); this.renderer.domElement.removeEventListener('webglcontextrestored', this.onRestored);
    this.questVisuals.dispose(); this.hellVisuals.dispose();
    this.overlay.remove(); this.library.dispose(); this.resources.forEach(r => r.dispose());
    this.groundTexture.dispose(); this.groundMaterial.dispose(); this.groundGeometry.dispose(); this.pitGeometry.dispose(); this.pitMaterial.dispose(); this.bottomGeometry.dispose(); this.bottomMaterial.dispose();
    this.sun.shadow.dispose(); this.renderer.dispose(); this.scene.clear(); this.visuals.clear(); this.props.clear(); this.powers.clear();
  }
}
