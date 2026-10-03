import * as THREE from 'three';
import { GRASS, PERCH, BURROW_EXITS, type Game, type Vec } from './naturaData';
import { ARCHER_BRANCHES, WATERLINE, insectLanding, type ArcherGame } from './archerfish';
import { snapPlatforms, foodTarget, predatorsAt, HABITATS, PATTERN_NAMES, SNAP_GRAVITY, SNAP_SPEED, type WildGame } from './wildModes';
import { bolasTip, coconutFood, raidPredators, type ToolGame } from './toolAnimals';
import type { Expedition } from './expeditions';
import type { LaneOcean } from './laneOcean';
export type NaturaWorld = { kind: 'meadow'; game: Game } | { kind: 'archerfish'; game: ArcherGame } | WildGame | ToolGame | Expedition | LaneOcean;
const CORAL = '#ff956f', GOLD = '#ffdc72';
const palette = ['#d3c296', '#869a84', '#be7b74', '#539778', '#d6bcc0', '#58768c'];
/** Real WebGL meshes, lights, depth and perspective. Simulations remain independent of rendering. */
export class NaturaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 450);
  private objects = new Map<string, THREE.Object3D>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private used = new Set<string>();
  private geometries = {
    sphere: new THREE.SphereGeometry(1, 16, 12), box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 8), cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
    torus: new THREE.TorusGeometry(1, 0.07, 6, 40),
  };
  private resize: ResizeObserver;
  private canvas: HTMLCanvasElement;
  private viewport = { width: 1, height: 1 };
  private lost: (event: Event) => void;
  constructor(canvas: HTMLCanvasElement, _mode: NaturaWorld['kind'], onLost: () => void) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.add(new THREE.HemisphereLight('#e4f8ff', '#293e35', 2.3));
    const sun = new THREE.DirectionalLight('#fff1c6', 3.2); sun.position.set(-12, 26, 16); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 100 });
    sun.shadow.bias = -0.001; this.scene.add(sun);
    this.lost = event => { event.preventDefault(); onLost(); };
    canvas.addEventListener('webglcontextlost', this.lost);
    this.resize = new ResizeObserver(() => this.size()); this.resize.observe(canvas); this.size();
  }
  private size() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.viewport = {width, height}; this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  private mat(color: string) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: color === '#83cddd' ? 0.3 : 0 }));
    return this.materials.get(color)!;
  }
  private part(parent: THREE.Object3D, shape: keyof NaturaScene['geometries'], color: string, pos: number[], scale: number[], rotation = 0) {
    const mesh = new THREE.Mesh(this.geometries[shape], this.mat(color));
    mesh.position.set(pos[0], pos[1], pos[2]); mesh.scale.set(scale[0], scale[1], scale[2]); mesh.rotation.z = rotation;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private object(key: string, make: () => THREE.Object3D) {
    let object = this.objects.get(key);
    if (!object) { object = make(); this.objects.set(key, object); this.scene.add(object); }
    this.used.add(key); object.visible = true; return object;
  }
  private shape(key: string, shape: keyof NaturaScene['geometries'], color: string, pos: number[], scale: number[], rotation = 0) {
    const mesh = this.object(key, () => new THREE.Mesh(this.geometries[shape], this.mat(color))) as THREE.Mesh;
    mesh.material = this.mat(color); mesh.position.set(pos[0], pos[1], pos[2]); mesh.scale.set(scale[0], scale[1], scale[2]); mesh.rotation.set(0, 0, rotation); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  }
  private label(key: string, text: string, position: number[], color = '#ffffff', scale = 1) {
    const sprite = this.object('label:' + key + text, () => {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#102e32dd'; ctx.roundRect(0, 0, 512, 96, 24); ctx.fill();
      ctx.fillStyle = color; ctx.font = '600 54px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 48, 480);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Sprite(new THREE.SpriteMaterial({map: texture, depthTest: false}));
    });
    sprite.position.set(position[0], position[1], position[2]); sprite.scale.set(5.5 * scale, 1.03 * scale, 1);
  }
  private animal(key: string, kind: string, color: string, pos: number[], scale = 1, facing = 1, time = 0) {
    const obj = this.object(key + kind + color, () => {
      const g = new THREE.Group();
      if (['ant', 'spider', 'moth'].includes(kind)) {
        this.part(g, 'sphere', color, [-0.34, 0.12, 0], [0.48, 0.36, 0.4]);
        this.part(g, 'sphere', color, [0.32, 0.16, 0], [0.34, 0.3, 0.32]);
        const count = kind === 'ant' ? 3 : 4;
        for (let side = -1; side <= 1; side += 2) for (let i = 0; i < count; i++) {
          const leg = this.part(g, 'cylinder', '#382e30', [-0.4 + i * 0.24, 0, side * 0.47], [0.045, 0.7, 0.045]); leg.rotation.x = side * 1.02; leg.rotation.z = (i - 1.5) * 0.25;
        }
        [0.18, -0.18].forEach(z => { this.part(g, 'sphere', '#111c25', [0.56, 0.27, z], [0.14, 0.16, 0.12]); this.part(g, 'sphere', '#ffffff', [0.64, 0.32, z], [0.035, 0.04, 0.04]); });
        if (kind === 'ant') [-1,1].forEach(side => this.part(g, 'cone', '#e9d08e', [0.78, 0.04, side * 0.18], [0.08, 0.48, 0.1], -Math.PI / 2 + side * 0.25));
        if (kind === 'moth') [-1,1].forEach(side => this.part(g, 'sphere', '#eee4b4', [0, 0.1, side * 0.55], [0.65, 0.05, 0.6]));
      } else if (kind === 'bird') {
        this.part(g, 'sphere', color, [0, 0, 0], [0.75, 0.33, 0.35]);
        this.part(g, 'sphere', color, [0.55, 0.26, 0], [0.3, 0.3, 0.3]);
        this.part(g, 'cone', '#e3b64e', [0.95, 0.24, 0], [0.14, 0.45, 0.13], -Math.PI / 2);
        [-1,1].forEach(side => { this.part(g, 'sphere', color, [-0.05, 0.06, side * 0.85], [0.55, 0.09, 1.25]); this.part(g, 'sphere', '#142e36', [0.65, 0.35, side * 0.24], [0.07, 0.07, 0.05]); });
        this.part(g, 'cone', '#563f40', [-0.9, 0, 0], [0.35, 0.8, 0.18], Math.PI / 2);
      } else if (kind === 'vole') {
        this.part(g, 'sphere', color, [0, 0, 0], [0.6, 0.4, 0.35]); this.part(g, 'sphere', color, [0.45, 0.08, 0], [0.35, 0.3, 0.3]);
        [-1,1].forEach(side => { this.part(g, 'sphere', '#c79e8e', [0.35, 0.34, side * 0.21], [0.16, 0.17, 0.07]); this.part(g, 'sphere', '#0c1820', [0.6, 0.17, side * 0.24], [0.055, 0.06, 0.05]); });
        this.part(g, 'cylinder', '#b69b85', [-0.8, -0.12, 0], [0.045, 0.6, 0.04], Math.PI / 2);
      } else if (kind === 'whale') {
        this.part(g, 'sphere', color, [-0.4, 0, 0], [2.4, 0.85, 0.85]);
        this.part(g, 'box', color, [1.1, 0.14, 0], [2.3, 1.45, 1.5]);
        this.part(g, 'sphere', '#b9d1d3', [1, -0.62, 0], [1.1, 0.12, 0.6]);
        [-1,1].forEach(side => { this.part(g, 'sphere', color, [-2.5, 0, side * 0.6], [0.6, 0.12, 0.95]); this.part(g, 'sphere', '#15242e', [1, -0.05, side * 0.77], [0.09, 0.09, 0.05]); this.part(g, 'sphere', color, [0.1, -0.4, side * 0.9], [0.6, 0.12, 0.7]); });
      } else if (['squid','cuttle','octopus'].includes(kind)) {
        this.part(g, 'sphere', color, [-0.4, 0.2, 0], [kind === 'squid' ? 1.2 : 0.65, 0.48, 0.5]);
        this.part(g, 'sphere', color, [0.3, 0.1, 0], [0.36, 0.36, 0.38]);
        [-1,1].forEach(side => { this.part(g, 'sphere', '#ede6c7', [0.32, 0.26, side * 0.33], [0.17, 0.18, 0.1]); this.part(g, 'sphere', '#17252c', [0.39, 0.28, side * 0.4], [0.1, 0.11, 0.04]); });
        for (let i = 0; i < (kind === 'octopus' ? 8 : 10); i++) {
          const a = i * Math.PI * 2 / 10;
          const points = Array.from({length: 6}, (_, j) => new THREE.Vector3(0.3 + j * (kind === 'squid' && i > 7 ? 0.5 : 0.28), Math.sin(a) * (0.15 + j * 0.08) - j * 0.06, Math.cos(a) * (0.2 + j * 0.08)));
          const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, 0.055, 5, false), this.mat(color)); g.add(tube);
        }
        if (kind !== 'octopus') [-1,1].forEach(side => this.part(g, 'sphere', color, [-0.9, 0.15, side * 0.45], [0.6, 0.07, 0.4]));
      } else {
        this.part(g, 'sphere', color, [0, 0, 0], [0.8, 0.32, 0.25]);
        this.part(g, 'cone', color, [-0.9, 0, 0], [0.43, 0.7, 0.1], -Math.PI / 2);
        this.part(g, 'cone', '#4c8495', [-0.05, 0.35, 0], [0.25, 0.45, 0.1], -0.35);
        [-1,1].forEach(side => this.part(g, 'sphere', '#111f29', [0.52, 0.1, side * 0.23], [0.07, 0.07, 0.04]));
        if (kind === 'flyingfish') [-1,1].forEach(side => this.part(g, 'sphere', '#b6ece3', [-0.1, 0, side * 0.75], [0.8, 0.045, 0.75]));
      }
      return g;
    });
    obj.position.set(pos[0], pos[1], pos[2]); obj.scale.setScalar(scale); obj.rotation.set(0, facing < 0 ? Math.PI : 0, 0);
    if (kind === 'bird') obj.children.forEach((part, i) => { if (i === 3 || i === 5) part.rotation.x = Math.sin(time * 7) * 0.16; });
    return obj;
  }
  private side(v: Vec, z = 0): number[] { return [(v.x - 480) / 30, (270 - v.y) / 30, z]; }
  private floorPoint(v: Vec, y = 0.45): number[] { return [(v.x - 480) / 30, y, (v.y - 270) / 30]; }
  private ring(key: string, pos: number[], color: string, radius = 0.7, flat = false) {
    const r = this.shape(key, 'torus', color, pos, [radius, radius, radius]); if (flat) r.rotation.x = Math.PI / 2; return r;
  }
  private line(key: string, a: number[], b: number[], color: string, width = 0.03) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = this.shape(key, 'cylinder', color, start.add(end).multiplyScalar(0.5).toArray(), [width, delta.length(), width]);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize());
  }
  private backdrop(kind: string, time: number) {
    const ocean = ['cuttlefish','coconut','archerfish','flyingfish','spermwhale'].includes(kind);
    const dark = kind === 'bolas' || kind === 'spermwhale';
    this.scene.background = new THREE.Color(dark ? '#071d32' : ocean ? '#69b6c6' : '#9fcac0');
    this.scene.fog = new THREE.Fog(dark ? '#071d32' : ocean ? '#69b6c6' : '#9fcac0', 60, 210);
    if (kind === 'flyingfish' || kind === 'spermwhale' || kind === 'jumpingspider') return;
    if (kind === 'meadow') {
      this.scene.background = new THREE.Color('#b9d4c7');
      for (let i=0;i<6;i++) this.shape('hill'+i,'sphere',i%2?'#709d80':'#91af80',[-30+i*12,-8,-16-i%2*7],[14,7,7]);
      this.shape('sun','sphere','#fff0b5',[14,10,-25],[2,2,2]);
      return;
    }
    const top = kind === 'cuttlefish' || kind === 'coconut';
    this.shape('base', 'box', ocean ? '#8cb5a1' : '#62764d', [0, top ? -0.6 : -8, -3], [43, 1, top ? 29 : 15]);
    for (let i = 0; i < 28; i++) {
      const x = ((i * 127) % 1000 - 500) / 25, z = -4 - (i % 5) * 2;
      if (!ocean) {
        this.shape('trunk'+i, 'cylinder', '#5e6950', [x, -2, z - 5], [0.25 + i % 3 * 0.1, 14, 0.3]);
        this.shape('canopy'+i, 'sphere', dark ? '#1e5057' : '#488273', [x, 6 + i % 3, z - 5], [3.8, 2.6, 3]);
      } else this.shape('rock'+i, 'sphere', i % 2 ? '#7a9b93' : '#568f83', [x, top ? 0 : -7, z], [0.5+i%3*0.3, 0.6, 0.5]);
    }
    for (let i = 0; i < 20; i++) this.shape('pollen'+i, 'sphere', dark ? '#c2f78c' : '#f0e3ad', [Math.sin(i * 7 + time * 0.12) * 17, Math.sin(i * 2.1 + time * 0.2) * 7, -3 - i % 6], [0.035, 0.035, 0.035]);
  }
  draw(world: NaturaWorld, ai: boolean) {
    this.used.clear();
    const t = 'game' in world ? world.kind === 'meadow' ? world.game.t : world.game.elapsed : world.elapsed;
    this.backdrop(world.kind, t);
    const top = world.kind === 'cuttlefish' || world.kind === 'coconut';
    const distance = Math.max(top ? 36 : 30, 18 / this.camera.aspect / Math.tan(24 * Math.PI / 180));
    this.camera.position.set(0, top ? distance * 0.82 : 2, top ? distance * 0.55 : distance);
    this.camera.lookAt(0, 0, 0);
    if (world.kind === 'meadow') this.meadow(world.game);
    else if (world.kind === 'archerfish') this.archer(world.game);
    else if (world.kind === 'trapjaw') this.snap(world);
    else if (world.kind === 'cuttlefish') this.cuttle(world);
    else if (world.kind === 'bolas' || world.kind === 'coconut') this.tool(world);
    else if (world.kind === 'flyingfish') this.ocean(world, ai);
    else if (world.kind === 'jumpingspider' || world.kind === 'spermwhale') this.expedition(world, ai);
    this.objects.forEach((obj,key) => { if (!this.used.has(key)) obj.visible = false; });
    this.renderer.render(this.scene, this.camera);
  }
  private meadow(g: Game) {
    this.shape('meadow-ground', 'box', '#67955b', [0,-4.4,0], [34,0.7,7]);
    GRASS.forEach((p,i) => {
      const center = p.x+p.width/2;
      this.label('cover'+i, 'COVER', this.side({x:center,y:320},0), '#e4f8c4',0.65);
      for(let j=0;j<8;j++) { const grass=this.shape(`grass${i}-${j}`,'cone',j%2?'#3e8457':'#85a857',this.side({x:p.x+j*p.width/8,y:374},-0.5),[0.32,1.7,0.38]);grass.rotation.z=Math.sin(g.t+j)*0.1; }
    });
    this.shape('perch','box','#81604b',this.side({x:PERCH.x+43,y:PERCH.y}),[PERCH.width/30,0.2,0.7]);
    this.shape('perch-post','cylinder','#81604b',this.side({x:PERCH.x+43,y:270},-0.3),[0.15,8,0.15]);
    this.label('perch','PERCH · REFILL 5',this.side({x:PERCH.x+43,y:95},0),'#ffdc72',0.85);
    BURROW_EXITS.forEach((x,i)=>{this.shape('burrow'+i,'sphere','#233631',this.side({x,y:389},0.3),[0.9,0.18,0.8]);this.label('tunnel'+i,'TUNNEL',this.side({x,y:433},0),'#fff3d1',0.75);});
    const bird=this.animal('kestrel','bird','#b98057',this.side(g.falcon,0.2),1.05,g.falconFacing,g.t);
    bird.rotation.z=g.dive>0?-0.8*g.falconFacing:g.recovering?0.45*g.falconFacing:0;
    if (g.burrowTravel<=0 && g.phase!=='capture') this.animal('vole','vole','#a69078',this.side(g.phase==='boss'?g.boss:g.mouse,0.7),g.phase==='boss'?2.5:0.8,g.mouseFacing);
    if(g.phase==='capture')this.animal('carried','vole','#a69078',this.side({x:g.falcon.x,y:g.falcon.y+20},0.7),0.6);
    if(g.bossAttack>0)this.shape('boss-strike','cone','#ef8c66',this.side({x:g.boss.x,y:g.boss.y-90},0),[1.4,6,0.4]);
    g.flightTrail.forEach((p,i)=>this.shape('trail'+i,'sphere','#ffe4a3',this.side(p,-0.1),[0.06,0.06,0.06]));
  }
  private archer(g: ArcherGame) {
    this.shape('pond','box','#288798',[0,-5.65,-2],[35,7,3]);
    ARCHER_BRANCHES.forEach((b,i)=>{this.shape('branch'+i,'box','#77664c',this.side({x:b.x,y:b.y-15},-0.4),[3,0.18,1]); this.shape('leaves'+i,'sphere','#387763',this.side({x:b.x,y:b.y-35},-0.8),[1.6,0.35,0.8]);});
    g.fish.forEach((f,i)=>{
      const color=i?GOLD:CORAL; this.animal('fish'+i,'fish',color,this.side({x:f.x,y:WATERLINE+14},0.2),0.9,f.facing);
      for(let j=1;j<22;j++){const seconds=j*0.02;const p={x:f.x+Math.cos(f.angle)*690*seconds,y:WATERLINE-3+Math.sin(f.angle)*690*seconds+125*seconds*seconds};if(p.y<WATERLINE)this.shape(`aim${i}-${j}`,'sphere','#15303b',this.side(p,0.3),[0.07,0.07,0.07]);}
    });
    g.insects.forEach(p=>{this.animal('insect'+p.id,'moth','#e5d9a0',this.side(p,0.3),0.35);if(p.state!=='perched')this.ring('landing'+p.id,this.side(insectLanding(p),0.4),'#fff2a1',0.5);});
    g.shots.forEach((p,i)=>this.shape('shot'+i,'sphere','#e8ffff',this.side(p,0.4),[0.13,0.2,0.13]));
  }
  private snap(g: Extract<WildGame,{kind:'trapjaw'}>) {
    const platforms=snapPlatforms(g);
    platforms.forEach((p,i)=>{this.shape('ledge'+i,'box',i===platforms.length-1?'#bf9b50':'#816852',this.side({x:p.x+p.width/2,y:p.y+22},0),[p.width/30,1.5,2.8]);this.shape('moss'+i,'box','#accb77',this.side({x:p.x+p.width/2,y:p.y+2},0),[p.width/30,0.13,2.85]);this.label('ledge-label'+i,i===platforms.length-1?'NEST':String(i+1),this.side({x:p.x+p.width/2,y:p.y+50},1),'#ffffff',0.5);});
    g.players.forEach((p,i)=>{
      const color=i?GOLD:CORAL; this.animal('ant'+i,'ant',color,this.side({x:p.x,y:p.y-9},i?0.4:0.8),0.65,p.facing,g.elapsed);
      if(p.grounded)for(let j=1;j<28;j++){const t=j*0.045,a=p.angle*Math.PI/180;const v={x:p.x+Math.cos(a)*SNAP_SPEED*p.facing*t,y:p.y-Math.sin(a)*SNAP_SPEED*t+SNAP_GRAVITY*t*t/2};if(v.y<540)this.shape(`trajectory${i}-${j}`,'sphere','#15303b',this.side(v,0.8),[0.075,0.075,0.075]);}
    });
  }
  private cuttle(g: Extract<WildGame,{kind:'cuttlefish'}>) {
    g.patches.forEach((p,i)=>{
      const obj=this.object('patch'+g.seed+'-'+i,()=>{const shape=new THREE.Shape();p.polygon.forEach((v,j)=>{if(j===0)shape.moveTo((v.x-480)/30,(v.y-270)/30);else shape.lineTo((v.x-480)/30,(v.y-270)/30);});const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:HABITATS[p.pattern].color,side:THREE.DoubleSide,roughness:0.85}));mesh.rotation.x=Math.PI/2;return mesh;}); obj.position.y=0;
      this.label('habitat'+i,`${PATTERN_NAMES[p.pattern]} · ${HABITATS[p.pattern].bumpy?'bumpy':'smooth'}`,this.floorPoint(p,0.1),'#ffffff',0.53);
    });
    g.players.forEach((p,i)=>{this.animal('cuttle'+i,'cuttle',palette[p.pattern],this.floorPoint(p),0.8);this.ring('player-ring'+i,this.floorPoint(p,0.1),i?GOLD:CORAL,0.75,true);if(p.bumpy)for(let j=0;j<6;j++)this.shape(`papilla${i}-${j}`,'cone',palette[p.pattern],this.floorPoint({x:p.x-15+j*5,y:p.y},0.95),[0.08,0.25,0.08]);const target=foodTarget(i as 0|1,p.food);if(target){this.animal('shrimp'+i,'fish',i?GOLD:CORAL,this.floorPoint(target,0.5),0.35);this.label('food'+i,`${i+1} · SHRIMP`,this.floorPoint(target,1.7),i?GOLD:CORAL,0.5);}});
    predatorsAt(g.elapsed).forEach((p,i)=>{this.animal('predator'+i,'fish','#345a66',this.floorPoint(p,1),1.4,p.facing);this.viewCone('vision'+i,this.floorPoint(p,0.2),p.facing);});
  }
  private viewCone(key:string,pos:number[],facing:number) {
    const cone=this.object(key,()=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,8,0,-4.1,8,0,4.1],3));return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#ffbc71',transparent:true,opacity:0.23,side:THREE.DoubleSide,depthWrite:false}));});cone.position.set(...pos as [number,number,number]);cone.rotation.y=facing<0?Math.PI:0;
  }
  private tool(g: ToolGame) {
    if(g.kind==='bolas') {
      this.shape('night-branch','box','#6e5c54',this.side({x:480,y:110},-1.5),[34,0.35,2]);
      g.players.forEach((p,i)=>{const color=i?GOLD:CORAL;this.animal('spider'+i,'spider',color,this.side(p,0.5),0.95);const tip=bolasTip(p);this.line('silk'+i,this.side(p,0.5),this.side(tip,0.5),'#c1ded4',0.025);this.shape('sticky'+i,'sphere',color,this.side(tip,0.5),[0.22,0.22,0.22]);if(p.lure>0)this.ring('lure'+i,this.side({x:p.x,y:p.y+120},-0.2),'#cae594',2.2+Math.sin(g.elapsed*3)*0.25);});
      g.moths.forEach((p,i)=>this.animal('moth'+i,'moth','#e7d8b3',this.side(p,0.4),0.4,1,g.elapsed));
    } else {
      g.players.forEach((p,i)=>{
        const color=i?GOLD:CORAL;
        if(!p.hidden)this.animal('octopus'+i,'octopus',color,this.floorPoint(p),0.7);
        const at=this.floorPoint(p.carrying?p:p.shell,p.hidden?0.55:0.3);this.shape('shell'+i,'sphere','#785648',at,[0.8,p.hidden?0.75:0.35,0.8]);this.ring('shell-marker'+i,[at[0],0.08,at[2]],color,0.9,true);
        const target=coconutFood(i as 0|1,p.food);if(target){this.animal('food'+i,'fish',color,this.floorPoint(target),0.35);this.label('food-number'+i,`${i+1} · FOOD`,this.floorPoint(target,1.5),color,0.5);}
      });
      if(g.raid.stage!=='calm')g.raid.lanes.forEach((y,i)=>this.shape('warning'+i,'box','#f1a56f',[0,0.08,(y-270)/30],[32,0.04,2.7]));
      raidPredators(g).forEach((p,i)=>this.animal('hunter'+i,'fish','#365460',this.floorPoint(p,1),1.5,i?-1:1));
    }
  }
  private ocean(g: LaneOcean, ai: boolean) {
    const sky=g.zone==='sky';this.scene.background=new THREE.Color(sky?'#99d8eb':'#124a6a');this.scene.fog=new THREE.Fog(sky?'#99d8eb':'#124a6a',40,110);
    this.camera.position.set(0,7,17);this.camera.lookAt(0,1,-23);
    this.shape('ocean-floor','box',sky?'#238ca5':'#164b5e',[0,-2,-35],[120,0.5,160]);
    for(let i=0;i<30;i++){const z=-85+((i*6+g.elapsed*12)%110);this.shape('wave'+i,'box',sky?'#7ccbcc':'#24728a',[0,-1.65,z],[35,0.06,0.08]);}
    for(let i=0;i<3;i++){this.shape('lane'+i,'box',sky?'#7dd5d6':'#34788e',[(i-1)*5,-1.5,-32],[0.06,0.06,90]);this.label('lane-label'+i,['LEFT','MIDDLE','RIGHT'][i],[(i-1)*5,-0.5,4],'#ffffff',0.48);}
    g.waves.forEach((w,i)=>w.lanes.forEach(l=>{
      const animal=this.animal(`obstacle${i}-${l}`,w.kind==='gull'?'bird':'fish',w.kind==='gull'?'#f1f2df':'#83cddd',[(l-1)*5,1,w.z],w.kind==='gull'?1.15:1.5,1,g.elapsed);
      animal.rotation.y=-Math.PI/2;this.ring(`danger${i}-${l}`,[(l-1)*5,-1.35,w.z],'#ffd6aa',1.6,true);
    }));
    g.players.forEach((p,i)=>{if(ai&&i===1||p.lives===0)return;const a=this.animal('flyer'+i,'flyingfish',i?GOLD:CORAL,[p.x,0.5+i*1.5,0],0.85);a.rotation.y=Math.PI/2;this.ring('flyer-ring'+i,[p.x,-1.4,0],i?GOLD:CORAL,0.65,true);});
  }
  private expedition(g: Expedition, ai: boolean) {
    const p=g.players[0], other=g.players[1];
    if(g.kind==='jumpingspider') {
      const focus=ai?p:{x:(p.x+other.x)/2,y:(p.y+other.y)/2,z:(p.z+other.z)/2};
      const separation=ai?0:Math.min(60,Math.abs(p.z-other.z)*0.55);
      this.camera.position.set(focus.x+12,focus.y+15+separation,focus.z+21+separation);this.camera.lookAt(focus.x,focus.y,focus.z-6);
      this.shape('forest-floor','box','#284f41',[0,-11,-62],[65,1,160]);
      for(let i=0;i<48;i++) {
        const x=(i%2?1:-1)*(12+Math.sin(i*3)*5), z=-i*2.8;
        this.shape('garden-rock'+i,'sphere',i%3?'#497b59':'#687e69',[x,-7,z],[2+i%3,4,2]);
        const stem=this.shape('garden-stem'+i,'cylinder','#548b58',[x,-3,z],[0.12,10,0.12]);stem.rotation.z=Math.sin(i)*0.2;
        this.shape('garden-leaf'+i,'sphere',g.level===2?'#659b96':'#80a868',[x,1,z],[2.5,0.12,1.1],Math.sin(i));
        if(i%4===0)for(let j=0;j<5;j++)this.shape(`petal${i}-${j}`,'sphere',g.level===1?'#f1bc76':'#d3a8ba',[x+Math.cos(j*1.26)*0.8,2,z+Math.sin(j*1.26)*0.8],[0.7,0.22,0.7]);
      }
      g.platforms.forEach((t,i)=>{
        const color=t.checkpoint?'#b1cc68':g.level===1?'#aa8868':g.level===2?'#72ad9a':'#6ca260';
        this.shape('leaf'+i,g.level===1?'box':'sphere',color,[t.x,t.y-0.28,t.z],[t.radius*(g.level===1?2:1),g.level===1?0.55:0.28,t.radius*(g.level===1?2:1)]);
        this.shape('stem'+i,'cylinder','#52775c',[t.x,t.y-4,t.z],[0.16,7.5,0.16]);
        this.ring('platform-ring'+i,[t.x,t.y+0.06,t.z],t.checkpoint?'#fff4a3':'#95cca1',t.radius*0.78,true);
        if(t.checkpoint)this.label('checkpoint'+i,i===23?'SUMMIT':`CHECKPOINT ${i+1}`,[t.x,t.y+1.2,t.z],'#fff4a3',0.62);
      });
      g.players.forEach((a,i)=>{if(a.lives<=0)return;const spider=this.animal('jumper'+i,'spider',i?GOLD:CORAL,[a.x,a.y+0.35,a.z],0.75);spider.rotation.y=a.heading;if(!a.grounded&&a.silk>0){const c=g.platforms[a.checkpoint];this.line('safety'+i,[c.x,c.y+0.2,c.z],[a.x,a.y,a.z],'#dff8dc',0.02);}});
    } else {
      this.scene.background=new THREE.Color('#061e33');this.scene.fog=new THREE.Fog('#061e33',22,100);
      const center=ai?p:{x:(p.x+other.x)/2,y:(p.y+other.y)/2,z:(p.z+other.z)/2};
      const separation=ai?0:Math.min(35,Math.hypot(p.x-other.x,p.y-other.y,p.z-other.z)*0.5);
      this.camera.position.set(center.x+15+separation,Math.min(-0.3,center.y+14+separation),center.z+25+separation);this.camera.lookAt(center.x,center.y-2,center.z-6);
      const surface=this.shape('surface','box','#73c6cf',[0,2,0],[130,0.2,140]);surface.castShadow=false;surface.receiveShadow=false;this.mat('#73c6cf').emissive.set('#103c49');this.shape('abyss-floor','box','#1d3944',[0,-69,0],[130,1,140]);
      for(let i=0;i<50;i++)this.shape('plankton'+i,'sphere','#80c8ce',[Math.sin(i*15)*35,-(i*17%65),Math.cos(i*7)*35],[0.045,0.045,0.045]);
      g.players.forEach((a,i)=>{if(ai&&i===1||a.lives<=0)return;const whale=this.animal('whale'+i,'whale',i?'#baa887':'#6b9aa8',[a.x,a.y,a.z],1.3);whale.rotation.y=a.heading;this.label('whale-number'+i,i?'2':'1',[a.x,a.y+2,a.z],i?GOLD:CORAL,0.4);if(a.sonar>0)this.ring('sonar'+i,[a.x,a.y,a.z],'#7ff2e0',(4-a.sonar)*5+1,true);});
      g.squids.forEach((s,i)=>{if(s.health<=0||ai&&s.owner===1)return;const owner=g.players[s.owner];const near=Math.hypot(s.x-owner.x,s.y-owner.y,s.z-owner.z)<13;if(owner.sonar>0||near){const obj=this.animal('squid'+i,'squid','#c06565',[s.x,s.y,s.z],1.6);obj.rotation.y=Math.sin(g.elapsed)*0.2;this.label('squid-health'+i,`${s.health} / 3`,[s.x,s.y+2.5,s.z],'#ffd9c4',0.5);if(s.warning>0)this.ring('tentacle'+i,[s.x,s.y,s.z],'#ff705d',8,true);}});
    }
  }
  /** Pointer aiming intersects the same world plane used by the archer simulation. */
  aim(clientX:number,clientY:number):Vec {
    const rect=this.canvas.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((clientX-rect.left)/this.viewport.width*2-1,-(clientY-rect.top)/this.viewport.height*2+1),this.camera);
    const target=new THREE.Vector3();ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),target);return {x:target.x*30+480,y:270-target.y*30};
  }
  dispose() {
    this.resize.disconnect();this.canvas.removeEventListener('webglcontextlost',this.lost);
    const geometries=new Set<THREE.BufferGeometry>(Object.values(this.geometries));const materials=new Set<THREE.Material>(this.materials.values());
    this.scene.traverse(obj=>{if(obj instanceof THREE.Mesh){geometries.add(obj.geometry);(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>materials.add(m));}else if(obj instanceof THREE.Sprite){obj.material.map?.dispose();materials.add(obj.material);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();this.objects.clear();
  }
}
