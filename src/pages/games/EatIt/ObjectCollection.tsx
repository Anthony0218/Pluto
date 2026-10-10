import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useState } from 'react';
import * as T from 'three';
import { FOOD, type FoodKind, type PowerKind } from '../../../games/eat-it/config';
import { collectionLabel } from '../../../games/eat-it/review';
import { ModelLibrary } from '../../../games/eat-it/models';
import { POWER_SYMBOL, POWER_COLOR } from '../../../games/eat-it/terrain';
import { ui } from '../../../i18n/ui';

/** Review thumbnails reuse the actual world models, with one disposable renderer per grid. */
export default function ObjectCollection({ counts }: { counts: Record<string, number> }) {
  useGameLanguage();
  const [icons, setIcons] = useState<Record<string, string>>({});
  useEffect(() => {
    const kinds = Object.keys(counts).filter(k => k in FOOD) as FoodKind[];
    if (!kinds.length) return;
    const frame = requestAnimationFrame(() => {
    const library = new ModelLibrary(); let renderer: T.WebGLRenderer | undefined;
    try {
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true }); renderer.setSize(96,96);
      const scene = new T.Scene(); scene.add(new T.HemisphereLight(0xffffff, 0x776655, 3));
      const light = new T.DirectionalLight(0xffffff, 3); light.position.set(-100,200,100); scene.add(light);
      const result: Record<string,string> = {};
      for (const kind of kinds) {
        const model = library.prop(kind); scene.add(model);
        const box = new T.Box3().setFromObject(model), center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3()).length()*.65;
        const camera = new T.OrthographicCamera(-size,size,size,-size,.1,5000);
        camera.position.copy(center).add(new T.Vector3(size,size*1.2,size*1.5)); camera.lookAt(center);
        renderer.render(scene,camera); result[kind] = renderer.domElement.toDataURL(); scene.remove(model);
      }
      setIcons(result);
    } catch { /* Counts and accessible names remain available when WebGL is unavailable. */ }
    finally { library.dispose(); renderer?.dispose(); }
    });
    return () => cancelAnimationFrame(frame);
  }, [counts]);
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
  if (!entries.length) return null;
  return <section><h3>{ui('Objects collected')}</h3><div className="eat-collection">{entries.map(([kind,count]) => {
    const name = ui(collectionLabel(kind));
    return <figure key={kind}>{icons[kind] ? <img src={icons[kind]} alt={gameUi(name)} /> : <span className="eat-collection-icon" style={{ color:POWER_COLOR[kind as PowerKind] }}>{gameUi(POWER_SYMBOL[kind as PowerKind] ?? '●')}</span>}<figcaption>{gameUi(name)}<br/><strong>× {gameUi(count)}</strong></figcaption></figure>;
  })}</div></section>;
}
