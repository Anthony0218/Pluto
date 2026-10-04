import { surfaceTexture, type Surface } from './surfaceTextures.ts';
import { treeGeometry } from './treeGeometry.ts';
import * as T from 'three';
import { FOOD, type FoodKind, type PowerKind } from './config.ts';
import { objectHeight } from './falling.ts';

/** All geometry is authored here from primitives. No external models, textures,
 * logos, product likenesses, or third-party character designs are loaded. */
export class ModelLibrary {
  private materials = new Map<string, T.MeshStandardMaterial>();
  private textures = new Map<Surface, T.DataTexture>();
  private geometries = new Map<string, T.BufferGeometry>();
  private templates = new Map<FoodKind, T.Group>();
  material(color: string) {
    let m = this.materials.get(color);
    if (!m) { m = new T.MeshStandardMaterial({ color, roughness: color === '#a4d7da' ? .16 : .85, metalness: color === '#a4d7da' ? .35 : 0 }); this.materials.set(color, m); }
    return m;
  }
  surface(color: string, surface: Surface) {
    const key = `${surface}:${color}`;
    let material = this.materials.get(key);
    if (!material) {
      let map = this.textures.get(surface);
      if (!map) { map = surfaceTexture(surface); this.textures.set(surface, map); }
      material = new T.MeshStandardMaterial({ color, map, bumpMap: map,
        bumpScale: surface === 'paint' ? .03 : surface === 'brick' || surface === 'roof' ? .65 : .18,
        roughness: surface === 'paint' ? .28 : surface === 'rubber' ? .96 : .83,
        metalness: surface === 'paint' ? .38 : 0 });
      this.materials.set(key, material);
    }
    return material;
  }
  finish(mesh: T.Mesh, color: string, surface: Surface) {
    mesh.material = this.surface(color, surface);
    return mesh;
  }
  geometry(kind: 'box' | 'ball' | 'cylinder' | 'cone' | 'ring' | 'rock') {
    let g = this.geometries.get(kind);
    if (!g) {
      g = kind === 'box' ? new T.BoxGeometry(1, 1, 1) : kind === 'ball' ? new T.SphereGeometry(1, 12, 8) :
        kind === 'rock' ? new T.IcosahedronGeometry(1, 0) : kind === 'ring' ? new T.TorusGeometry(1, .24, 8, 24) :
        new T.CylinderGeometry(kind === 'cone' ? 0 : 1, 1, 1, 12);
      this.geometries.set(kind, g);
    }
    return g;
  }
  part(group: T.Group, kind: Parameters<ModelLibrary['geometry']>[0], color: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new T.Mesh(this.geometry(kind), this.material(color));
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  prop(kind: FoodKind, golden = false): T.Group {
    let template = this.templates.get(kind);
    if (!template) { template = this.build(kind); this.templates.set(kind, template); }
    const group = template.clone(true);
    if (golden && kind === 'fish') {
      const gold = this.material('#ffd34e'); gold.roughness = .25; gold.metalness = .7;
      gold.emissive.set('#8c5500'); gold.emissiveIntensity = .2;
      for (const name of ['fish-body', 'tail', 'fin']) {
        const mesh = group.getObjectByName(name); if (mesh instanceof T.Mesh) mesh.material = gold;
      }
    }
    return group;
  }
  power(kind: PowerKind): T.Group {
    const group = new T.Group(), colors: Record<PowerKind, string> = { speed: '#bceb56', shield: '#70cfff', magnet: '#e6a0ff', multiplier: '#ffcc63', divider: '#ff665e', jump: '#65edce', strike: '#ff9754', shock: '#6ebfff' }, color = colors[kind];
    const ring = this.part(group, 'ring', color, 0, 0, 0, 15, 15, 4); ring.rotation.x = Math.PI / 2;
    this.part(group, 'cylinder', '#263c46', 0, 0, 0, 12, 5, 12);
    if (kind === 'shield') {
      this.part(group, 'ball', color, 0, 11, 0, 10, 13, 6); this.part(group, 'box', '#efffff', 0, 12, 6, 3, 15, 2);
    } else if (kind === 'magnet') {
      const arch = this.part(group, 'ring', color, 0, 12, 0, 8, 10, 3); arch.rotation.y = Math.PI / 2;
      for (const side of [-1, 1]) this.part(group, 'box', '#fff9e6', side*7, 8, 0, 5, 9, 6);
    } else if (kind === 'speed' || kind === 'strike' || kind === 'shock') {
      for (const side of [-1, 1]) { const bolt = this.part(group, 'box', color, side*3, 10+side*4, 0, 6, 14, 5); bolt.rotation.z = -.5; }
    } else if (kind === 'jump') {
      this.part(group, 'box', color, 0, 12, 0, 5, 18, 5);
      for (const side of [-1, 1]) { const wing = this.part(group, 'box', '#e8fff9', side*5, 18, 0, 4, 12, 4); wing.rotation.z = side*.7; }
    } else {
      for (const side of [-1, 1]) this.part(group, 'ball', color, side*6, 11, 0, 6, 6, 6);
      const slash = this.part(group, 'box', '#fff4d0', 0, 12, 0, 3, 19, 3); slash.rotation.z = -.5;
    }
    return group;
  }
  private build(kind: FoodKind) {
    const group = new T.Group(), f = FOOD[kind], w = f.width, d = f.height, h = objectHeight(kind) - f.underpassClearance * 1.15, color = f.color;
    const box = (c: string, x: number, y: number, z: number, a: number, b: number, e: number) => this.part(group, 'box', c, x, y, z, a, b, e);
    const ball = (c: string, x: number, y: number, z: number, a: number, b: number, e: number) => this.part(group, 'ball', c, x, y, z, a, b, e);
    const cylinder = (c: string, x: number, y: number, z: number, a: number, b: number, e = a) => this.part(group, 'cylinder', c, x, y, z, a, b, e);
    const timber = '#936e52', dark = '#34434a', glass = '#a4d7da', cream = '#fff0ce';
    if (f.shape === 'human') {
      const shirt = ['#5bbcca', '#b392ef', '#f18878', '#eec65f'][Math.round(w) % 4];
      ball(color, 0, 31, 0, 5.5, 6, 5.5); ball('#65453b', -1, 35, 0, 5, 3, 5);
      box(shirt, 0, 21, 0, 9, 13, 11).name='shirt';
      for (const side of [-1, 1]) {
        const leg = box('#344757', 0, 8, side*3.4, 4, 13, 4); leg.name = `leg${side}`;
        const arm = box(color, 0, 22, side*7, 4, 12, 4); arm.name = `arm${side}`;
        box('#fff3df', 2, 2, side*3.4, 7, 4, 5);
        ball('#253346', 5, 32, side*2.2, 1, 1.2, 1);
      }
      ball('#f18c81', 5.8, 29, 0, .7, 1.4, 1.5);
    } else if (f.shape === 'fish') {
      ball(color, 1, 7, 0, w*.37, 6, d*.36).name = 'fish-body';
      const tail = this.part(group, 'cone', '#f3b762', -w*.37, 7, 0, 6, 10, d*.4); tail.rotation.z = Math.PI/2; tail.name='tail';
      const fin = this.part(group, 'cone', '#beece3', 0, 13, 0, 5, 6, 2); fin.rotation.z = -.3; fin.name = 'fin';
      for (const side of [-1,1]) { ball(cream, w*.24, 9, side*d*.29, 3, 3, 1.4); ball(dark, w*.27, 9, side*d*.34, 1.4, 1.6, .6); }
    } else if (f.shape === 'factory') {
      const tower = kind === 'factorySky' || kind === 'factoryTower', wall = h * (tower ? .78 : .64);
      this.finish(box(color, 0, wall/2, 0, w*.92, wall, d*.9), color, 'paint');
      box('#364955', 0, 5, 0, w, 10, d);
      box('#fff0ce', 0, wall+3, 0, w*.98, 6, d*.96);
      // A roof-face badge is legible from the arena's overhead camera as well.
      box(dark,0,wall+7,d*.2,w*.38,2,d*.25);
      for(const side of [-1,1]){ball(cream,side*w*.14,wall+11,-d*.02,w*.08,4,d*.075);ball(dark,side*w*.14,wall+15,-d*.02,w*.034,1,d*.034);}
      for(let i=0;i<5;i++){const fang=this.part(group,'cone',cream,(i-2)*w*.064,wall+9,d*.12,w*.022,2,d*.06);fang.rotation.x=Math.PI/2;}
      for (const side of [-1,1]) {
        cylinder('#45596a', side*w*.31, wall+(h-wall)*.45, -d*.22, w*.075, (h-wall)*.9);
        cylinder('#f9c75c', side*w*.31, h-4, -d*.22, w*.095, 8);
        ball(cream, side*w*.18, wall*.64, d*.457, w*.095, wall*.12, 3);
        ball(dark, side*w*.18, wall*.64, d*.475, w*.035, wall*.06, 2);
        box('#a4d7da', side*w*.465, wall*.56, 0, 2, wall*.28, d*.62);
      }
      box(dark, 0, wall*.24, d*.46, w*.5, wall*.36, 4);
      for (let i=0;i<5;i++) {
        const tooth=this.part(group,'cone',cream,(i-2)*w*.085,wall*.34,d*.48,w*.035,wall*.14,2); tooth.rotation.z=Math.PI;
        box('#f9c75c',(i-2)*w*.16,wall*.88,d*.46,w*.07,wall*.07,3);
      }
      if(tower) for(let row=1;row<4;row++)box('#bce7e8',0,wall*(.48+row*.1),-d*.457,w*.65,wall*.025,2);
    } else if (f.shape === 'candyLandmark') {
      if (kind === 'giantCandy') {
        ball(color,0,h*.48,0,w*.32,h*.46,d*.46);
        for(const side of [-1,1]) {
          const wrap=this.part(group,'cone','#fff0ce',side*w*.39,h*.48,0,h*.3,w*.2,d*.3);
          wrap.rotation.z=side*Math.PI/2;
        }
        for(const x of [-1,0,1])box('#fff0ce',x*w*.12,h*.9,0,w*.035,h*.05,d*.52);
      } else if (kind === 'chocolateStack') {
        for(let row=0;row<3;row++) {
          box(row%2?color:'#684639',0,h*(.15+row*.3),0,w*(.96-row*.14),h*.28,d*(.96-row*.14));
          for(const x of [-1,0,1])for(const z of [-1,1])box('#b17b60',x*w*.21,h*(.3+row*.3),z*d*.17,w*.18,h*.035,d*.25);
        }
      } else if (kind === 'giantCupcake') {
        cylinder(color,0,h*.27,0,w*.38,h*.54,d*.38);
        for(let i=0;i<10;i++){const a=i*Math.PI/5;box('#dbc5ff',Math.cos(a)*w*.36,h*.28,Math.sin(a)*d*.36,w*.035,h*.46,d*.035);}
        ball('#fff0e0',0,h*.65,0,w*.48,h*.25,d*.48);
        ball('#efb5ce',0,h*.82,0,w*.3,h*.12,d*.3);
        ball('#e87361',0,h*.96,0,w*.055,h*.04,d*.055);
        for(const x of [-1,1])for(const z of [-1,1])box('#95e0d0',x*w*.24,h*.87,z*d*.18,w*.065,h*.025,d*.025);
      } else {
        ball(color,0,h*.44,0,w*.48,h*.44,d*.48);
        ball('#ffd9eb',-w*.16,h*.77,-d*.1,w*.14,h*.08,d*.12);
        const band=this.part(group,'ring','#b86fa5',0,h*.15,0,w*.38,d*.38,h*.08);band.rotation.x=Math.PI/2;
        ball('#fff0ce',0,h*.93,0,w*.09,h*.07,d*.09);
      }
    } else if (f.shape === 'iceLandmark') {
      if(kind==='iceBlock') {
        this.finish(box(color,0,h*.48,0,w*.94,h*.96,d*.94),color,'paint');
        box('#effcff',0,h*.98,0,w*.96,h*.04,d*.96);
        for(const x of [-1,1])box('#dcfaff',x*w*.27,h*.52,d*.475,w*.025,h*.65,2);
      } else if(kind==='iceberg') {
        this.part(group,'rock',color,0,h*.28,0,w*.48,h*.28,d*.48);
        for(const side of [-1,0,1]) {
          const height=h*(side===0?.84:.56);
          this.part(group,'cone',side===0?'#effcff':'#9cdded',side*w*.2,height/2,side*d*.12,w*.25,height,d*.28);
        }
        this.part(group,'rock','#ffffff',0,h*.88,0,w*.11,h*.1,d*.12);
      } else {
        for(const x of [-1,0,1])for(const z of [-1,1]) {
          const height=h*(.52+(x===0?.38:.1)+(z===1?.06:0));
          box(color,x*w*.31,height/2,z*d*.23,w*.3,height,d*.46);
          box('#effcff',x*w*.31,height,z*d*.23,w*.3,h*.035,d*.46);
          box('#c4f3ff',x*w*.31,height*.56,z*d*.46,w*.035,height*.7,2);
        }
      }
    } else if (f.shape === 'forestLandmark') {
      if(kind==='giantMushroom') {
        cylinder('#e5d5b2',0,h*.34,0,w*.16,h*.68,d*.16);
        ball(color,0,h*.76,0,w*.48,h*.24,d*.48);
        for(const x of [-1,0,1])for(const z of [-1,1])ball('#fff0ce',x*w*.23,h*.92,z*d*.18,w*.055,h*.025,d*.055);
      } else if(kind==='mossBoulder') {
        this.part(group,'rock','#879083',0,h*.42,0,w*.48,h*.42,d*.48);
        for(const side of [-1,0,1])ball(color,side*w*.18,h*.71,side*d*.12,w*.2,h*.12,d*.2);
        for(const side of [-1,1])ball('#739a52',side*w*.3,h*.25,0,w*.14,h*.13,d*.25);
      } else {
        this.finish(cylinder(color,0,h*.45,0,w*.42,h*.9,d*.42),color,'wood');
        cylinder('#d9b990',0,h*.91,0,w*.39,h*.025,d*.39);
        for(const radius of [.12,.24,.35]){const ring=this.part(group,'ring','#936e52',0,h*.932,0,w*radius,d*radius,h*.022);ring.rotation.x=Math.PI/2;}
        for(const side of [-1,1])ball('#739a52',side*w*.28,h*.22,side*d*.2,w*.18,h*.2,d*.17);
      }
    } else if (kind === 'candyMint') {
      cylinder(cream,0,5,0,w*.48,10,d*.48);
      for(let i=0;i<6;i++){ const stripe=box(color,0,10.2,0,w*.84,1,3); stripe.rotation.y=i*Math.PI/3; }
    } else if (kind === 'chocolate') {
      box('#684639',0,4,0,w,8,d);
      for(let x=-1;x<=1;x++)for(const z of [-1,1])box(color,x*w*.31,9,z*d*.23,w*.28,5,d*.4);
    } else if (kind === 'jelly') {
      ball(color,0,11,0,w*.48,11,d*.48);ball('#ffe8f7',-w*.16,18,d*.1,4,2,3);
      for(const side of [-1,1])ball(dark,side*w*.15,11,d*.46,2,2,1);
    } else if (kind === 'snowCone') {
      this.part(group,'cone',cream,0,9,0,7,18,7).rotation.z=Math.PI;
      ball(color,0,20,0,10,9,10);ball('#fffaff',-3,26,2,5,3,4);
    } else if (kind === 'iceCrystal') {
      this.part(group,'rock',color,0,12,0,w*.36,12,d*.36);
      for(const side of [-1,1]){const crystal=this.part(group,'cone',side===1?'#dfffff':'#8cc7eb',side*8,12,0,5,22,5);crystal.rotation.z=side*.3;}
    } else if (f.shape === 'shrine') {
      box('#b0aaa0',0,4,0,w,8,d);
      box(color,0,38,0,w*.58,68,d*.6);
      box('#534f53',0,78,0,w*.9,10,d*.85);
      for(const side of [-1,1]) {
        cylinder('#c86b50',side*w*.36,46,d*.32,6,84);
        const roof=box('#686462',side*w*.22,89,0,w*.51,8,d*.9);roof.rotation.z=side*-.2;
      }
      box('#c86b50',0,94,d*.32,w,8,12);box('#eac67a',0,43,d*.31,25,28,2);
    } else if (f.shape === 'cup') {
      cylinder(color,0,h*.45,0,w*.4,h*.9,d*.4);cylinder(cream,0,h*.92,0,w*.44,2,d*.44);
      cylinder('#654c3e',0,h*.97,0,w*.32,1,d*.32);
      const handle=this.part(group,'ring',color,w*.38,h*.55,0,w*.14,h*.2,2);handle.rotation.y=Math.PI/2;
    } else if (f.shape === 'phone') {
      box(dark,0,2,0,w,4,d);box('#96d9df',0,4.1,-1,w*.8,.4,d*.74);cylinder(cream,0,4.5,d*.4,1,.4);
    } else if (f.shape === 'cone') {
      box(dark,0,2,0,w,4,d);this.part(group,'cone',color,0,h*.55,0,w*.42,h,d*.42);
      cylinder(cream,0,h*.5,0,w*.23,4,d*.23);
    } else if (f.shape === 'box') {
      box(color,0,h/2,0,w,h,d);
      if(kind==='woodenCrate')for(const side of [-1,1])for(const y of [.15,.85])box('#705638',0,h*y,side*d*.49,w,4,3);
      else {box('#e4c495',0,h+.5,0,5,1,d);box(cream,w*.23,h*.55,d*.501,w*.25,h*.28,1);}
    } else if (f.shape === 'skateboard') {
      box(color,0,8,0,w,4,d*.9);
      for(const x of [-1,1])for(const z of [-1,1]){const wheel=cylinder(dark,x*w*.34,4,z*d*.36,4,4);wheel.rotation.x=Math.PI/2;}
    } else if (f.shape === 'hydrant') {
      cylinder(color,0,h*.5,0,w*.25,h);ball(color,0,h,0,w*.3,h*.16,d*.3);
      box(color,0,h*.6,0,w,h*.2,d*.35);cylinder(dark,0,2,0,w*.43,4);
    } else if (f.shape === 'acorn') {
      ball(color,0,h*.4,0,w*.4,h*.4,d*.4);ball('#70583c',0,h*.76,0,w*.5,h*.17,d*.5);cylinder(timber,0,h*.95,0,1,5);
    } else if (f.shape === 'pinecone') {
      for(let row=0;row<4;row++)for(let i=0;i<5;i++){const a=i*Math.PI*2/5+row*.5,r=w*(.36-row*.06);this.part(group,'rock',row%2?color:'#bd9569',Math.cos(a)*r,h*(.16+row*.22),Math.sin(a)*r,r,h*.19,r);}
    } else if (f.shape === 'nest') {
      const nest=this.part(group,'ring',color,0,h*.24,0,w*.38,d*.38,h*.7);nest.rotation.x=Math.PI/2;
      for(const x of [-1,1])ball(cream,x*w*.13,h*.3,0,w*.12,h*.26,d*.13);
    } else if (f.shape === 'tent') {
      const roof=box(color,0,h*.42,0,w*.7,5,d);roof.rotation.z=Math.PI/4;
      const other=box(color,w*.25,h*.42,0,w*.7,5,d);other.rotation.z=-Math.PI/4;roof.position.x=-w*.25;
      box('#524d46',0,2,0,w,4,d);
      for(const z of [-1,1])cylinder(timber,0,h*.45,z*d*.43,2,h*.9);
    } else if (f.shape === 'hay') {
      const bale=cylinder(color,0,h*.48,0,d*.47,w,d*.47);bale.rotation.z=Math.PI/2;
      for(const x of [-1,1]){const band=this.part(group,'ring','#968455',x*w*.3,h*.48,0,d*.47,d*.47,2);band.rotation.y=Math.PI/2;}
    } else if (f.shape === 'cart') {
      for(const x of [-1,1])for(const z of [-1,1]){const wheel=cylinder(dark,x*w*.33,7,z*d*.42,7,5);wheel.rotation.x=Math.PI/2;}
      box(color,0,h*.4,0,w*.8,5,d*.8);
      for(const side of [-1,1])for(let i=0;i<5;i++)box(color,(i-2)*w*.17,h*.65,side*d*.4,3,h*.5,3);
      for(const side of [-1,1])box(color,0,h*.9,side*d*.4,w*.9,3,3);
      box(dark,-w*.48,h,0,4,4,d);
    } else if (f.shape === 'pluto') {
      ball('#b8a08a', 0, h * .47, 0, w * .44, h * .44, d * .44);
      // Pale heart-shaped nitrogen plain against rusty equatorial patches.
      for (const side of [-1, 1]) ball('#eee1c6', side * w * .09, h * .83, d * .10, w * .13, h * .075, d * .17);
      ball('#eee1c6', 0, h * .80, d * .22, w * .12, h * .055, d * .14);
      for (let i = 0; i < 5; i++) { const a = i * 1.2; ball(i % 2 ? '#997c6e' : '#cfb496', Math.cos(a) * w * .26, h * .70, Math.sin(a) * d * .26, w * .09, h * .06, d * .08); }
      const rim = this.part(group, 'ring', '#ffc753', 0, h * .47, 0, w * .4, d * .4, h * .08); rim.rotation.x = -Math.PI / 2;
      const glow = ball('#ffd973', 0, h * .47, 0, w * .51, h * .51, d * .51); glow.castShadow = false; glow.receiveShadow = false;
      const halo = this.material('#ffd973'); halo.transparent = true; halo.opacity = .08; halo.depthWrite = false; halo.emissive.set('#ffbd44'); halo.emissiveIntensity = .6; halo.blending = T.AdditiveBlending;
      const gold = this.material('#ffc753'); gold.emissive.set('#d89422'); gold.emissiveIntensity = .5; gold.metalness = .45;
    } else if (kind === 'skyscraper' || kind === 'officeTower') {
      // Flat-roofed towers: stacked setbacks, window bands and a rooftop crown.
      const tiers = kind === 'skyscraper' ? [[1, .55], [.78, .3], [.52, .15]] : [[1, .78], [.7, .22]];
      let base = 0;
      tiers.forEach(([scale, share], tier) => {
        const height = h * share, tw = w * .94 * scale, td = d * .94 * scale;
        box(tier % 2 ? '#93a9b8' : color, 0, base + height / 2, 0, tw, height, td);
        for (let y = base + 14; y < base + height - 8; y += 22) for (const side of [-1, 1]) {
          box(glass, 0, y, side * td * .502, tw * .86, 9, 2); box(glass, side * tw * .502, y, 0, 2, 9, td * .86);
        }
        base += height;
      });
      box('#5d6a72', 0, base + 4, 0, w * .4, 8, d * .4);
      cylinder('#c9d0d4', 0, base + 36, 0, 2.5, 64);
      if (kind === 'skyscraper') ball('#ff6b5a', 0, base + 70, 0, 4, 4, 4);
      box('#e8dbbf', 0, 4, 0, w, 8, d);
      box(dark, 0, 18, d * .48, w * .3, 30, 3);
    } else if (kind === 'windmill') {
      // Tapered stone tower, cone cap and four sail arms facing the camera.
      cylinder(color, 0, h * .38, 0, w * .3, h * .76, d * .3);
      cylinder('#cbbd9f', 0, h * .04, 0, w * .38, h * .08, d * .38);
      this.part(group, 'cone', '#9a5b48', 0, h * .84, 0, w * .34, h * .18, d * .34);
      box(timber, 0, h * .2, d * .3, w * .14, h * .2, 3);
      for (const y of [.42, .6]) box(glass, 0, h * y, d * .3, w * .1, h * .07, 2);
      for (let i = 0; i < 4; i++) {
        const arm = box('#f3ead8', 0, h * .74, d * .36, w * .1, h * .46, 3);
        arm.position.set(Math.sin(i * Math.PI / 2 + .4) * h * .23, h * .74 + Math.cos(i * Math.PI / 2 + .4) * h * .23, d * .36); arm.rotation.z = -(i * Math.PI / 2 + .4);
      }
      cylinder(dark, 0, h * .74, d * .34, 6, 8).rotation.x = Math.PI / 2;
    } else if (f.shape === 'building') {
      const wall = h * .72;
      this.finish(box(color, 0, wall / 2, 0, w * .94, wall, d * .94), color, kind === 'barn' || kind === 'farmhouse' ? 'siding' : 'brick');
      box('#e8dbbf', 0, 4, 0, w, 8, d);
      // A custom triangular prism makes a pitched roof with genuine end faces.
      const roof = new T.BufferGeometry();
      const a = w / 2, b = d / 2, top = h, low = wall;
      const verts = [-a,low,-b, a,low,-b, 0,top,-b, -a,low,b, 0,top,b, a,low,b,
        -a,low,-b, 0,top,-b, 0,top,b, -a,low,-b, 0,top,b, -a,low,b,
        a,low,-b, a,low,b, 0,top,b, a,low,-b, 0,top,b, 0,top,-b,
        -a,low,-b, -a,low,b, a,low,b, -a,low,-b, a,low,b, a,low,-b];
      // Outward winding: the pitched surfaces must face up, not into the walls.
      for (let i = 0; i < verts.length; i += 9) for (let axis = 0; axis < 3; axis++) {
        [verts[i + 3 + axis], verts[i + 6 + axis]] = [verts[i + 6 + axis], verts[i + 3 + axis]];
      }
      roof.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
      const uvs: number[] = [];
      for (let i = 0; i < verts.length; i += 9) {
        const endFace = verts[i + 2] === verts[i + 5] && verts[i + 2] === verts[i + 8];
        for (let j = 0; j < 9; j += 3) uvs.push((endFace ? verts[i + j] / w : verts[i + j + 2] / d) + .5, endFace ? verts[i + j + 1] / h : verts[i + j] / w + .5);
      }
      roof.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); roof.computeVertexNormals();
      this.geometries.set(`roof-${kind}`, roof);
      const mesh = new T.Mesh(roof, this.surface(kind === 'barn' ? '#814e4a' : '#526975', 'roof')); mesh.name = 'roof'; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      this.finish(box(timber, 0, wall * .25, d * .474, w * .16, wall * .5, 2), timber, 'wood');
      ball('#dbb56a', w * .05, wall * .25, d * .49, 1.4, 1.4, 1.4);
      for (const side of [-1, 1]) box(cream, side * w * .47, wall * .5, d * .47, w * .035, wall, 3);
      box('#d8cbb5', 0, wall * .025, d * .49, w * .23, wall * .05, d * .08);
      for (const side of [-1, 1]) {
        for (let row = 0; row < (kind === 'apartment' ? 3 : kind === 'mansion' || kind === 'farmhouse' ? 2 : 1); row++) {
          box(cream, side * w * .29, wall * (.4 + row * .22), d * .477, w * .2, wall * .18, 3);
          box(glass, side * w * .29, wall * (.4 + row * .22), d * .49, w * .16, wall * .14, 2);
          box(cream, side * w * .29, wall * (.4 + row * .22), d * .503, w * .012, wall * .14, 1);
          box(cream, side * w * .29, wall * (.4 + row * .22), d * .503, w * .16, wall * .012, 1);
        }
        box(glass, side * w * .475, wall * .5, 0, 2, wall * .26, d * .32);
      }
      if (kind === 'mansion') { for (const side of [-1, 1]) cylinder(cream, side * w * .1, wall * .3, d * .5, 5, wall * .6); box(cream, 0, wall * .62, d * .5, w * .3, 6, 14); }
      if (kind === 'farmhouse') box(timber, 0, wall * .12, d * .52, w * .8, 6, 18);
      if (kind === 'cafe' || kind === 'kiosk') for (let i = 0; i < 8; i++) box(i % 2 ? cream : '#d78869', -w * .42 + i * w * .12, wall * .65, d * .47, w * .12, 5, d * .13);
      if (kind !== 'garage') box('#d4c6ae', w * .26, h * .84, -d * .2, w * .09, h * .27, d * .13);
    } else if (f.shape === 'vehicle') {
      const wheel = d * .18;
      box(dark, 0, wheel, 0, w * .82, h * .18, d * .75);
      this.finish(box(color, 0, h * .4, 0, w * .97, h * .4, d * .84), color, 'paint');
      box(glass, -w * .08, h * .7, 0, w * .43, h * .43, d * .72);
      this.finish(box(color, -w * .08, h * .96, 0, w * .47, h * .08, d * .79), color, 'paint');
      for (const side of [-1, 1]) {
        box(color, -w * .08, h * .72, side * d * .37, w * .025, h * .43, d * .025);
        box('#c9d5d7', w * .02, h * .45, side * d * .427, w * .09, h * .025, d * .025);
        this.finish(box(color, w * .12, h * .67, side * d * .45, w * .09, h * .085, d * .11), color, 'paint');
      }
      box('#aeb9be', w * .49, h * .28, 0, 2, h * .07, d * .77);
      box(dark, w * .492, h * .42, 0, 2, h * .12, d * .34);
      box(cream, w * .502, h * .3, 0, 1, h * .07, d * .2);
      if (kind === 'foodTruck') box('#f2dcc1', -w * .25, h * .68, 0, w * .45, h * .55, d * .86);
      if (kind === 'tractor') box(color, w * .23, h * .6, 0, w * .4, h * .28, d * .6);
      if (kind === 'bus') { box(color, 0, h * .66, 0, w * .97, h * .5, d * .84); for (let i = 0; i < 6; i++) for (const z of [-1, 1]) box(glass, -w * .4 + i * w * .15, h * .74, z * d * .425, w * .11, h * .2, 2); }
      if (kind === 'taxi') { box(cream, -w * .08, h * 1.04, 0, w * .16, h * .1, d * .3); box(dark, 0, h * .42, d * .425, w * .6, h * .06, 1); }
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const tire = cylinder(dark, x * w * .31, wheel, z * d * .4, wheel, d * .17); this.finish(tire, '#293139', 'rubber'); tire.rotation.x = Math.PI / 2; tire.name = 'wheel';
        const hub = cylinder('#d5cbbc', x * w * .31, wheel, z * d * .49, wheel * .48, 2); hub.rotation.x = Math.PI / 2; hub.name = 'wheel';
      }
      for (const z of [-1, 1]) { box(cream, w * .49, h * .42, z * d * .26, 2, h * .14, d * .16); box('#cd735e', -w * .49, h * .4, z * d * .26, 2, h * .12, d * .14); }
    } else if (f.shape === 'tree' || f.shape === 'pot' || f.shape === 'flower') {
      const tree = treeGeometry(kind);
      cylinder(timber, 0, h * .32, 0, tree.trunkRadius, h * .64);
      if (f.shape === 'pot') cylinder(color, 0, h * .2, 0, w * .35, h * .4);
      const foliage = f.shape === 'flower' ? color : '#8ca965';
      ball(foliage, 0, h * .72, 0, f.shape === 'tree' ? tree.canopyX : w * .42, h * .28, d * .4);
      ball(f.shape === 'flower' ? '#f4d78c' : '#b0c67d', -w * .18, h * .8, -d * .1, w * .23, h * .2, d * .23);
      ball(foliage, w * .16, h * .65, d * .04, w * .25, h * .23, d * .25);
    } else if (['chair', 'bench', 'sofa', 'table'].includes(f.shape)) {
      const seat = f.shape === 'table' ? h * .88 : h * .48;
      for (const x of [-1, 1]) for (const z of [-1, 1]) box(timber, x * w * .4, seat / 2, z * d * .34, 5, seat, 5);
      box(color, 0, seat, 0, w, h * .14, d);
      if (f.shape !== 'table') box(color, 0, h * .78, -d * .4, w, h * .44, d * .15);
      if (f.shape === 'sofa') {
        for (const x of [-1, 1]) box('#a37796', x * w * .43, h * .55, 0, w * .14, h * .6, d);
        for (const x of [-1, 0, 1]) box('#cda7be', x * w * .26, h * .6, d * .06, w * .24, h * .12, d * .65);
      }
    } else if (f.shape === 'bicycle') {
      for (const x of [-1, 1]) {
        const tire = this.part(group, 'ring', dark, x * w * .32, h * .35, 0, h * .28, h * .28, d * .15); tire.rotation.y = 0;
        box(color, x * w * .29, h * .54, 0, 4, h * .46, 4);
      }
      box(color, 0, h * .44, 0, w * .7, h * .12, d * .14);
      box(dark, -w * .14, h * .81, 0, w * .18, 4, d * .28);
      box(dark, w * .29, h * .96, 0, 4, 4, d * .7);
      if (kind === 'motorcycle') box(color, 0, h * .56, 0, w * .4, h * .32, d * .6);
    } else if (f.shape === 'sign') {
      cylinder('#8b9990', 0, h * .48, 0, 2, h * .96);
      box(color, 0, h * .83, 0, w, h * .28, 5); box(cream, 0, h * .83, 3, w * .65, 3, 1);
      cylinder('#727f77', 0, 2, 0, w * .3, 4);
    } else if (f.shape === 'boat') {
      ball(color, 0, h * .45, 0, w * .5, h * .45, d * .5);
      box('#816955', 0, h * .73, 0, w * .63, 4, d * .62);
      for (const x of [-1, 1]) box('#ecd5ac', x * w * .22, h * .8, 0, w * .07, 5, d * .7);
    } else if (f.shape === 'log') {
      const log = cylinder(timber, 0, h / 2, 0, d * .46, w); log.rotation.z = Math.PI / 2;
      for (const x of [-1, 1]) { const end = cylinder('#d8b883', x * w * .5, h / 2, 0, d * .4, 1); end.rotation.z = Math.PI / 2; }
    } else if (f.shape === 'barrel' || f.shape === 'bin' || kind === 'soda') {
      if (f.shape === 'bin') box(color, 0, h / 2, 0, w * .9, h, d * .9);
      else cylinder(color, 0, h / 2, 0, w * .48, h, d * .48);
      for (const y of [.12, .87]) {
        if (f.shape === 'bin') box(dark, 0, h * y, 0, w, 3, d);
        else cylinder('#c3bba6', 0, h * y, 0, w * .5, 3, d * .5);
      }
    } else if (f.shape === 'machine') {
      box(color, 0, h / 2, 0, w, h, d * .7); box(dark, -w * .12, h * .58, d * .36, w * .6, h * .65, 2);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box(['#e5b570', '#98c498', '#d89b9b'][j], (j - 1) * w * .17 - w * .12, h * (.35 + i * .18), d * .38, w * .1, h * .1, 2);
    } else if (f.shape === 'book') {
      box('#efe4cf', 0, h / 2, 0, w * .9, h * .7, d * .92);
      for (const y of [0, h]) box(color, 0, y, 0, w, 1, d);
      box(color, -w / 2, h / 2, 0, 2, h, d);
    } else if (f.shape === 'coin') {
      cylinder(color, 0, h / 2, 0, w / 2, h); cylinder('#ffe0a1', 0, h, 0, w * .35, 1);
    } else if (f.shape === 'stone' || f.shape === 'leaf') {
      this.part(group, 'rock', color, 0, h / 2, 0, w / 2, h / 2, d / 2);
      if (kind === 'giantBoulder') {
        this.part(group, 'rock', '#86918a', w * .28, h * .28, d * .22, w * .26, h * .28, d * .24);
        this.part(group, 'rock', '#a9b3ac', -w * .3, h * .22, -d * .18, w * .2, h * .22, d * .2);
        for (const [x, z] of [[-.12, .1], [.08, -.14], [.2, .05]]) ball('#7c9a5a', x * w, h * .92, z * d, w * .12, h * .05, d * .1);
      }
    } else if (f.shape === 'lamp') {
      cylinder('#3d4a50', 0, 3, 0, w * .4, 6); cylinder(color, 0, h * .48, 0, 2.6, h * .92);
      box(color, w * .18, h * .93, 0, w * .4, 3, 4); ball('#ffe9a8', w * .34, h * .88, 0, 6, 4, 6);
    } else if (f.shape === 'meter') {
      cylinder('#6c777d', 0, h * .32, 0, 2.5, h * .64); box(color, 0, h * .78, 0, w * .7, h * .36, d * .5);
      box(glass, 0, h * .84, d * .26, w * .45, h * .12, 1);
    } else if (f.shape === 'mailbox') {
      for (const x of [-1, 1]) box(dark, x * w * .3, h * .12, 0, 3, h * .24, 3);
      box(color, 0, h * .55, 0, w * .9, h * .55, d * .8); const top = cylinder(color, 0, h * .82, 0, w * .45, d * .8); top.rotation.x = Math.PI / 2;
      box(cream, 0, h * .65, d * .41, w * .5, 3, 1);
    } else if (f.shape === 'campfire') {
      for (let i = 0; i < 5; i++) { const log = cylinder(timber, Math.cos(i * 1.26) * w * .18, 5, Math.sin(i * 1.26) * d * .18, 4, w * .6); log.rotation.set(Math.PI / 2, 0, i * 1.26); }
      for (let i = 0; i < 8; i++) this.part(group, 'rock', '#8d8f88', Math.cos(i * .785) * w * .44, 4, Math.sin(i * .785) * d * .44, 6, 5, 6);
      this.part(group, 'cone', '#ff8a2a', 0, h * .55, 0, w * .2, h * .9, d * .2); this.part(group, 'cone', '#ffd96a', 0, h * .45, 0, w * .11, h * .6, d * .11);
    } else if (f.shape === 'scarecrow') {
      cylinder(timber, 0, h * .45, 0, 2.5, h * .9); box(timber, 0, h * .72, 0, w * .9, 3, 3);
      box('#6f8fb0', 0, h * .62, 0, w * .32, h * .3, d * .4); ball('#e8cf8f', 0, h * .86, 0, w * .12, h * .1, w * .12);
      this.part(group, 'cone', color, 0, h * .98, 0, w * .2, h * .12, w * .2);
      for (const x of [-1, 1]) box('#e0c46a', x * w * .46, h * .7, 0, w * .08, h * .1, 4);
    } else if (f.shape === 'beehive') {
      for (let i = 0; i < 4; i++) cylinder(i % 2 ? '#d7a43c' : color, 0, h * (.14 + i * .22), 0, w * (.46 - i * .07), h * .2, d * (.46 - i * .07));
      cylinder(dark, 0, h * .2, d * .42, 3, 2).rotation.x = Math.PI / 2;
    } else if (kind === 'hotDog') {
      const bun = cylinder('#e2b071', 0, h * .4, 0, d * .48, w * .9, d * .48); bun.rotation.z = Math.PI / 2;
      const sausage = cylinder('#b5513a', 0, h * .7, 0, d * .3, w, d * .3); sausage.rotation.z = Math.PI / 2;
      box('#f2c84b', 0, h * .92, 0, w * .7, 1.5, 2);
    } else if (kind === 'iceCream') {
      const cone = this.part(group, 'cone', '#d9a66a', 0, h * .3, 0, w * .4, h * .6, d * .4); cone.rotation.x = Math.PI;
      ball(color, 0, h * .7, 0, w * .48, h * .2, d * .48); ball('#fff0e0', 0, h * .86, 0, w * .36, h * .14, d * .36); ball('#d4473f', 0, h * .98, 0, 2.5, 2.5, 2.5);
    } else if (kind === 'pumpkin') {
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ball(i % 2 ? color : '#d9862d', Math.cos(a) * w * .14, h * .45, Math.sin(a) * d * .14, w * .32, h * .42, d * .32); }
      cylinder('#6b7d3e', 0, h * .92, 0, 2.5, h * .2);
    } else if (kind === 'carrot') {
      // Lies on its side: the root runs along the footprint's depth with leaves at the back.
      const root = this.part(group, 'cone', color, 0, w * .5, 0, w * .5, d * .8, w * .5); root.rotation.x = Math.PI / 2;
      for (const x of [-2, 0, 2]) { const leaf = box('#6aa04a', x, w * .6, -d * .45, 1.5, 1.5, 9); leaf.rotation.x = .4; }
    } else if (kind === 'donut') {
      const donut = this.part(group, 'ring', '#ce9864', 0, h * .3, 0, w * .39, d * .39, h * .8); donut.rotation.x = Math.PI / 2;
      const icing = this.part(group, 'ring', color, 0, h * .44, 0, w * .38, d * .38, h * .5); icing.rotation.x = Math.PI / 2;
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const sprinkle=box(i%2?'#fff0ce':'#95e0d0',Math.cos(a)*w*.36,h*.55,Math.sin(a)*d*.36,3,1,1);sprinkle.rotation.y=a;}
    } else if (kind === 'mushroom') {
      cylinder(cream, 0, h * .35, 0, w * .14, h * .7); ball(color, 0, h * .7, 0, w / 2, h * .3, d / 2);
      for (const x of [-1, 1]) ball(cream, x * w * .2, h * .91, 0, 2, 1, 2);
    } else if (kind === 'burger' || kind === 'cupcake') {
      cylinder(kind === 'burger' ? '#ad754d' : color, 0, h * .32, 0, w * .43, h * .6, d * .43);
      if (kind === 'burger') { cylinder('#80a45c', 0, h * .43, 0, w * .49, 3, d * .49); cylinder('#dc946c', 0, h * .57, 0, w * .45, 4, d * .45); }
      ball(kind === 'burger' ? '#e6bd7b' : cream, 0, h * .7, 0, w * .48, h * .3, d * .48);
      if(kind==='burger')for(let i=0;i<6;i++){const a=i*Math.PI/3;box(cream,Math.cos(a)*w*.24,h*.96,Math.sin(a)*d*.24,2,1,1);}
      else ball('#eb747e',0,h+2,0,3,3,3);
    } else if (kind === 'pizza') {
      cylinder('#dbb478', 0, 3, 0, w / 2, 6); cylinder('#f1d07b', 0, 6, 0, w * .45, 2);
      for (const x of [-1, 1]) for (const z of [-1, 1]) cylinder('#bd7156', x * w * .19, 8, z * d * .19, 4, 1);
    } else if (kind === 'fries') {
      box(color, 0, h * .3, 0, w * .85, h * .6, d * .7);
      for (let i = 0; i < 5; i++) box('#f4d18a', (i - 2) * w * .15, h * .68, 0, w * .11, h * (.55 + i % 2 * .1), d * .2);
    } else {
      ball(color, 0, h / 2, 0, w / 2, h / 2, d / 2);
      if (kind === 'apple' || kind === 'berry') { cylinder(timber, 0, h, 0, 1.2, 6); ball('#8ea85e', 3, h + 2, 0, 4, 1, 2); }
      if (f.shape === 'ball') for (const x of [-1, 1]) ball(dark, x * w * .24, h * .82, 0, w * .13, 1, d * .15);
    }
    if (f.underpassClearance) {
      const lift = f.underpassClearance * 1.15;
      for (const child of group.children) if (child.name !== 'wheel') child.position.y += lift;
      if (f.shape === 'vehicle') for (const x of [-1, 1]) for (const z of [-1, 1]) box('#34434a', x * w * .31, lift * .8, z * d * .34, 5, lift, 5);
      if (f.building) for (const x of [-1, 1]) for (const z of [-1, 1]) box('#777b76', x * w * .43, lift / 2, z * d * .43, 9, lift, 9);
    }
    return group;
  }
  dispose() { this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose()); this.textures.clear(); this.geometries.forEach(g => g.dispose()); this.templates.clear(); }
}
