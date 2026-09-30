import { treeGeometry } from './treeGeometry.ts';
import * as T from 'three';
import { FOOD, type FoodKind } from './config.ts';
import { objectHeight } from './falling.ts';

/** All geometry is authored here from primitives. No external models, textures,
 * logos, product likenesses, or third-party character designs are loaded. */
export class ModelLibrary {
  private materials = new Map<string, T.MeshStandardMaterial>();
  private geometries = new Map<string, T.BufferGeometry>();
  private templates = new Map<FoodKind, T.Group>();
  material(color: string) {
    let m = this.materials.get(color);
    if (!m) { m = new T.MeshStandardMaterial({ color, roughness: .85, metalness: 0 }); this.materials.set(color, m); }
    return m;
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
  prop(kind: FoodKind): T.Group {
    let template = this.templates.get(kind);
    if (!template) { template = this.build(kind); this.templates.set(kind, template); }
    return template.clone(true);
  }
  private build(kind: FoodKind) {
    const group = new T.Group(), f = FOOD[kind], w = f.width, d = f.height, h = objectHeight(kind) - f.underpassClearance * 1.15, color = f.color;
    const box = (c: string, x: number, y: number, z: number, a: number, b: number, e: number) => this.part(group, 'box', c, x, y, z, a, b, e);
    const ball = (c: string, x: number, y: number, z: number, a: number, b: number, e: number) => this.part(group, 'ball', c, x, y, z, a, b, e);
    const cylinder = (c: string, x: number, y: number, z: number, a: number, b: number, e = a) => this.part(group, 'cylinder', c, x, y, z, a, b, e);
    const timber = '#936e52', dark = '#34434a', glass = '#a4d7da', cream = '#fff0ce';
    if (f.shape === 'shrine') {
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
    } else if (f.shape === 'building') {
      const wall = h * .72;
      box(color, 0, wall / 2, 0, w * .94, wall, d * .94);
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
      roof.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); roof.computeVertexNormals();
      this.geometries.set(`roof-${kind}`, roof);
      const mesh = new T.Mesh(roof, this.material(kind === 'barn' ? '#814e4a' : '#657e7b')); mesh.name = 'roof'; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      box(timber, 0, wall * .25, d * .474, w * .16, wall * .5, 2);
      for (const side of [-1, 1]) {
        for (let row = 0; row < (kind === 'apartment' ? 3 : 1); row++) {
          box(cream, side * w * .29, wall * (.4 + row * .22), d * .477, w * .2, wall * .18, 3);
          box(glass, side * w * .29, wall * (.4 + row * .22), d * .49, w * .16, wall * .14, 2);
        }
        box(glass, side * w * .475, wall * .5, 0, 2, wall * .26, d * .32);
      }
      if (kind === 'cafe' || kind === 'kiosk') for (let i = 0; i < 8; i++) box(i % 2 ? cream : '#d78869', -w * .42 + i * w * .12, wall * .65, d * .47, w * .12, 5, d * .13);
      if (kind !== 'garage') box('#d4c6ae', w * .26, h * .84, -d * .2, w * .09, h * .27, d * .13);
    } else if (f.shape === 'vehicle') {
      const wheel = d * .18;
      box(dark, 0, wheel, 0, w * .82, h * .18, d * .75);
      box(color, 0, h * .4, 0, w * .97, h * .4, d * .84);
      box(glass, -w * .08, h * .7, 0, w * .43, h * .43, d * .72);
      box(color, -w * .08, h * .96, 0, w * .47, h * .08, d * .79);
      if (kind === 'foodTruck') box('#f2dcc1', -w * .25, h * .68, 0, w * .45, h * .55, d * .86);
      if (kind === 'tractor') box(color, w * .23, h * .6, 0, w * .4, h * .28, d * .6);
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const tire = cylinder(dark, x * w * .31, wheel, z * d * .4, wheel, d * .17); tire.rotation.x = Math.PI / 2; tire.name = 'wheel';
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
    } else if (kind === 'donut') {
      const donut = this.part(group, 'ring', '#ce9864', 0, h * .3, 0, w * .39, d * .39, h * .8); donut.rotation.x = Math.PI / 2;
      const icing = this.part(group, 'ring', color, 0, h * .44, 0, w * .38, d * .38, h * .5); icing.rotation.x = Math.PI / 2;
    } else if (kind === 'mushroom') {
      cylinder(cream, 0, h * .35, 0, w * .14, h * .7); ball(color, 0, h * .7, 0, w / 2, h * .3, d / 2);
      for (const x of [-1, 1]) ball(cream, x * w * .2, h * .91, 0, 2, 1, 2);
    } else if (kind === 'burger' || kind === 'cupcake') {
      cylinder(kind === 'burger' ? '#ad754d' : color, 0, h * .32, 0, w * .43, h * .6, d * .43);
      if (kind === 'burger') { cylinder('#80a45c', 0, h * .43, 0, w * .49, 3, d * .49); cylinder('#dc946c', 0, h * .57, 0, w * .45, 4, d * .45); }
      ball(kind === 'burger' ? '#e6bd7b' : cream, 0, h * .7, 0, w * .48, h * .3, d * .48);
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
  dispose() { this.materials.forEach(m => m.dispose()); this.geometries.forEach(g => g.dispose()); this.templates.clear(); }
}
