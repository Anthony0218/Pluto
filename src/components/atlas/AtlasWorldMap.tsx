import { FILL_SCOPES, focusForScope } from "../../games/atlas/scopes";
import { AtlasCountryShape } from "./AtlasCountryShape";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import { LocateFixed, Minus, Move, Plus } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Coordinates, GeographicEntity } from "../../games/atlas/types";

type Props = {
  topology: unknown;
  entities: GeographicEntity[];
  onSelect?: (entityId: string) => void;
  onPoint?: (coordinates: Coordinates) => void;
  /** `target` draws a dashed great-circle line from the pin to where its distance was measured. */
  pins?: { coordinates: Coordinates; label: string; color: string; target?: Coordinates }[];
  selectedId?: string | null;
  correctId?: string | null;
  incorrectId?: string | null;
  filledIds?: string[];
  ownership?: Record<string, "player_a" | "player_b">;
  legalIds?: string[];
  objectiveIds?: string[];
  routes?: [string, string][];
  disabled?: boolean;
  ariaLabel?: string;
  showHoverLabels?: boolean;
  /** [south-west, north-east] corners to zoom to (Map Fill regions); reset returns here instead of the whole world. */
  focus?: [Coordinates, Coordinates] | null;
};

const WIDTH = 960, HEIGHT = 560, MAX_ZOOM = 12;
const clampView = (view:View):View => ({...view,x:Math.max(WIDTH-WIDTH*view.scale,Math.min(0,view.x)),y:Math.max(HEIGHT-HEIGHT*view.scale,Math.min(0,view.y))});
type View = { x: number; y: number; scale: number };
const WORLD: View = { x: 0, y: 0, scale: 1 };

/** The pan and zoom that frame a longitude/latitude box, sampled along its edges because Equal Earth curves them. */
function fitView(projection: GeoProjection, focus?: [Coordinates, Coordinates] | null): View {
  if (!focus) return WORLD;
  const [[west, south], [east, north]] = focus, steps = 12;
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const longitude = west + (east - west) * index / steps, latitude = south + (north - south) * index / steps;
    return [[longitude, south], [longitude, north], [west, latitude], [east, latitude]] as [number, number][];
  }).flat().map((point) => projection(point)).filter((point): point is [number, number] => Boolean(point));
  if (!points.length) return WORLD;
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.max(1, Math.min(MAX_ZOOM, Math.min(WIDTH / Math.max(1, maxX - minX), HEIGHT / Math.max(1, maxY - minY)) * .94));
  return clampView({ scale, x: WIDTH / 2 - (minX + maxX) / 2 * scale, y: HEIGHT / 2 - (minY + maxY) / 2 * scale });
}

function AtlasWorldMapComponent({ topology, entities, onSelect, onPoint, pins = [], selectedId, correctId, incorrectId, filledIds = [], ownership = {}, legalIds = [], objectiveIds = [], routes = [], disabled, ariaLabel = "Interactive world map", showHoverLabels = true, focus }: Props) {
  useUiLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const draggedRef = useRef(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [touchPanning, setTouchPanning] = useState(false);
  const [region,setRegion]=useState("Auto");
  const [cluster,setCluster]=useState<GeographicEntity[]>([]);
  const [screenWidth,setScreenWidth]=useState(WIDTH);
  const activeFocus=region==="Auto"?focus:focusForScope(region);
  const pacific=Boolean(activeFocus&&activeFocus[1][0]>180);
  useEffect(()=>{const svg=svgRef.current;if(!svg)return;const observer=new ResizeObserver(entries=>setScreenWidth(entries[0].contentRect.width||WIDTH));observer.observe(svg);return ()=>observer.disconnect();},[]);
  const prepared = useMemo(() => {
    const typed = topology as Topology<{ countries: GeometryCollection }>;
    const collection = feature(typed, typed.objects.countries) as unknown as FeatureCollection;
    const projection = geoEqualEarth().rotate(pacific?[-160,0]:[0,0]).fitExtent([[18, 18], [WIDTH - 18, HEIGHT - 18]], collection);
    const path = geoPath(projection);
    const byGeometry = new Map(entities.filter((entity) => entity.playable && entity.status === "un195" && entity.geometryId).map((entity) => [entity.geometryId!, entity]));
    const shapes = collection.features.map((item: Feature<Geometry>, index) => {
      const geometryId = String(item.id).padStart(3, "0");
      return { key: `${geometryId}-${index}`, geometryId, path: path(item) || "", entity: byGeometry.get(geometryId) };
    });
    const smallEntities = entities.filter((entity) => entity.playable && entity.status === "un195" && entity.centroid && (!entity.geometryId || (entity.areaKm2?.value || 0) < 2500)).map((entity) => ({ entity, point: projection(entity.centroid!) })).filter((item) => item.point) as { entity: GeographicEntity; point: [number, number] }[];
    return { projection, shapes, smallEntities };
  }, [entities, topology,pacific]);
  const focusKey = activeFocus ? activeFocus.flat().join(",") : "";
  const [view, setView] = useState(() => fitView(prepared.projection, activeFocus));
  // A new region re-frames the map (state adjusted while rendering, so there is no flash of the old view).
  const [framedFocus, setFramedFocus] = useState(focusKey);
  if (framedFocus !== focusKey) { setFramedFocus(focusKey); setView(fitView(prepared.projection, activeFocus)); }
  const zoomAt = (factor: number, anchor: [number, number] = [WIDTH / 2, HEIGHT / 2]) => {
    setView((current) => {
      const scale = Math.max(1, Math.min(MAX_ZOOM, current.scale * factor));
      // Preserve the geographic point beneath the pointer as the map scales.
      const x = anchor[0] - (anchor[0] - current.x) * scale / current.scale;
      const y = anchor[1] - (anchor[1] - current.y) * scale / current.scale;
      return clampView({ x, y, scale });
    });
  };
  useEffect(() => {
    const map = svgRef.current;
    if (!map) return;
    const handleWheel = (event: WheelEvent) => {
      // A phone/tablet layout must allow scrolling through the map to the content below.
      if (window.matchMedia("(max-width: 950px)").matches && !touchPanning && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.18 : 0.84;
      const matrix = map.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      zoomAt(factor, [point.x, point.y]);
    };
    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, [touchPanning]);

  const statusClass = (entityId?: string) => {
    const accents = `${entityId === selectedId ? " atlas-country--chosen" : ""}${entityId && legalIds.includes(entityId) ? " atlas-country--legal" : ""}`;
    if (!entityId) return "atlas-country atlas-country--unmapped";
    if (entityId === correctId) return "atlas-country atlas-country--correct";
    if (entityId === incorrectId) return "atlas-country atlas-country--incorrect";
    if (ownership[entityId]) return `atlas-country atlas-country--${ownership[entityId]}${accents}`;
    if (filledIds.includes(entityId)) return "atlas-country atlas-country--filled";
    if (entityId === selectedId) return "atlas-country atlas-country--selected";
    return `atlas-country${accents}`;
  };

  const choose = (entity?: GeographicEntity) => {
    if (draggedRef.current) return;
    if (!disabled && entity) {
      if (!onPoint) onSelect?.(entity.id);
    }
  };
  const zoom = (factor: number) => zoomAt(factor);
  const pointerCoordinates = (event: React.PointerEvent<SVGSVGElement>): [number, number] => {
    // SVG's aspect-ratio padding must not shift pins, especially on tall mobile maps.
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return [0, 0];
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  };

  return (
    <div className={`atlas-map-shell ${touchPanning ? "is-panning" : ""}`}>
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={ariaLabel}
        onPointerDown={(event) => { const [x, y] = pointerCoordinates(event); draggedRef.current = false; dragRef.current = { x, y, originX: view.x, originY: view.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (!dragRef.current || (event.pointerType === "touch" && !touchPanning)) return; const [x, y] = pointerCoordinates(event); const start = dragRef.current; if (Math.hypot(x - start.x, y - start.y) * screenWidth / WIDTH > 6) draggedRef.current = true; setView((current) => clampView({ ...current, x: start.originX + x - start.x, y: start.originY + y - start.y })); }}
        onPointerCancel={() => { dragRef.current = null; draggedRef.current = true; }}
        onPointerUp={(event) => {
          const start = dragRef.current; dragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (start && !draggedRef.current && !disabled) {
            draggedRef.current = true;
            if (onPoint) {
              const [x, y] = pointerCoordinates(event);
              const location: [number, number] = [(x - view.x) / view.scale, (y - view.y) / view.scale];
              const coordinate = prepared.projection.invert?.(location);
              const projected = coordinate && prepared.projection(coordinate);
              if (coordinate && coordinate.every(Number.isFinite) && Math.abs(coordinate[0]) <= 180 && Math.abs(coordinate[1]) <= 90
                && projected && Math.hypot(projected[0] - location[0], projected[1] - location[1]) < 1) onPoint(coordinate as Coordinates);
            } else {
              const [x,y]=pointerCoordinates(event);
              const nearby=prepared.smallEntities.filter(({point})=>Math.hypot(point[0]*view.scale+view.x-x,point[1]*view.scale+view.y-y)*screenWidth/WIDTH <= 18);
              if(nearby.length>1) {setCluster(nearby.map(item=>item.entity));return;}
              if(nearby.length===1){onSelect?.(nearby[0].entity.id);return;}
              const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target as Element;
              const entityId = target.closest<SVGElement>("[data-atlas-entity]")?.dataset.atlasEntity;
              if (entityId) onSelect?.(entityId);
            }
          }
          window.setTimeout(() => { draggedRef.current = false; }, 0);
        }}>
        <defs><filter id="atlas-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <path d={geoPath(prepared.projection)({ type: "Sphere" }) || ""} className="atlas-ocean" />
          {prepared.shapes.map(({ key, path, entity }) => (
            <path key={key} d={path} aria-hidden={!entity || undefined} data-atlas-entity={entity?.id} className={statusClass(entity?.id)} role={entity&&!onPoint?"button":undefined} tabIndex={entity && !disabled && !onPoint ? 0 : -1}
              aria-label={entity ? showHoverLabels ? `Select ${entity.shortName}` : entity.centroid ? `Country near ${entity.centroid[1].toFixed(0)}° latitude, ${entity.centroid[0].toFixed(0)}° longitude` : "Country outline" : "Map entity unavailable for quiz play"}
              onClick={(event) => { event.stopPropagation(); choose(entity); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(entity); } }}
              onPointerEnter={() => entity && setHovered(entity.id)} onPointerLeave={() => setHovered(null)} />
          ))}
          {prepared.smallEntities.map(({ entity, point }) => (
            <g key={`marker-${entity.id}`} data-atlas-entity={entity.id} className={statusClass(entity.id)} transform={`translate(${point[0]} ${point[1]})`} onClick={(event) => { event.stopPropagation(); choose(entity); }}
              role={onPoint ? undefined : "button"} tabIndex={onPoint || disabled ? -1 : 0} aria-label={onPoint ? undefined : showHoverLabels ? `Select ${entity.shortName}` : `Country marker near ${entity.centroid?.[1].toFixed(0)}° latitude, ${entity.centroid?.[0].toFixed(0)}° longitude`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") {event.preventDefault();choose(entity);} }}>
              <circle r={18 * WIDTH / screenWidth / view.scale} className="atlas-hit-target" style={{pointerEvents:onPoint?"none":undefined}} />
              <circle r={Math.max(2.4, 4 / view.scale)} className="atlas-microstate" />
            </g>
          ))}
          {routes.map(([a,b]) => { const ca=entities.find(c=>c.id===a)?.centroid, cb=entities.find(c=>c.id===b)?.centroid; return ca&&cb&&<path key={`${a}:${b}`} className="atlas-strategy-route" vectorEffect="non-scaling-stroke" d={geoPath(prepared.projection)({type:"LineString",coordinates:[ca,cb]})||""}/>; })}
          {objectiveIds.map(id=>{const coordinate=entities.find(c=>c.id===id)?.centroid,point=coordinate&&prepared.projection(coordinate);return point&&<text key={`hub:${id}`} className="atlas-strategy-objective" x={point[0]} y={point[1]} transform={`translate(${point[0]} ${point[1]}) scale(${1/view.scale}) translate(${-point[0]} ${-point[1]})`}>★</text>;})}
          {pins.map(({ coordinates, color, target }, index) => target && <path key={`line-${index}`} className="atlas-map-pin-line" vectorEffect="non-scaling-stroke" style={{ color }} d={geoPath(prepared.projection)({ type: "LineString", coordinates: [coordinates, target] }) || ""} />)}
          {pins.map(({ coordinates, label, color }, index) => {
            const point = prepared.projection(coordinates);
            return point && <g key={`${label}-${index}`} className="atlas-map-pin" transform={`translate(${point[0]} ${point[1]}) scale(${1 / view.scale})`} style={{ color }}>
              <title>{label}</title>
              <path d="M0 0 C-3 -5 -10 -10 -10 -17 A10 10 0 1 1 10 -17 C10 -10 3 -5 0 0Z" />
              <circle cx={0} cy={-17} r={3.5} />
            </g>;
          })}
        </g>
      </svg>
      <label className="atlas-map-region"><span className="sr-only">Map region</span><select aria-label="Map region" value={region} onChange={event=>{setRegion(event.target.value);setCluster([]);}}><option value="Auto">Starting view</option>{FILL_SCOPES.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      {view.scale>1.05&&<svg className="atlas-map-overview" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="World orientation overview" role="img">{prepared.shapes.map(shape=><path key={shape.key} d={shape.path}/>)}<rect x={-view.x/view.scale} y={-view.y/view.scale} width={WIDTH/view.scale} height={HEIGHT/view.scale}/></svg>}
      {cluster.length>1&&!disabled&&<div className="atlas-map-cluster" role="dialog" aria-label="Nearby small countries"><strong>Choose a small country</strong><p>Several markers overlap here. Zoom in or choose an outline.</p><div>{cluster.map((entity,index)=><button key={entity.id} onClick={()=>{onSelect?.(entity.id);setCluster([]);}}>{entity.geometryId?<AtlasCountryShape topology={topology} geometryId={entity.geometryId} label={`Location ${index+1}`} showLabel={false}/>:<span>● {entity.centroid?.[1].toFixed(1)}°, {entity.centroid?.[0].toFixed(1)}°</span>}<span>{showHoverLabels?entity.shortName:`Location ${index+1}`}</span></button>)}</div><button onClick={()=>{const p=prepared.projection(cluster[0].centroid!);if(p)zoomAt(2,[p[0]*view.scale+view.x,p[1]*view.scale+view.y]);setCluster([]);}}>Zoom to markers</button><button onClick={()=>setCluster([])}>Close</button></div>}
      <div className="atlas-map-controls" aria-label="Map controls">
        <button type="button" className="atlas-map-pan-toggle" aria-pressed={touchPanning} onClick={() => setTouchPanning(current => !current)} aria-label={ui(touchPanning ? "Scroll page" : "Pan map")} title={ui(touchPanning ? "Scroll page" : "Pan map")}><Move size={18} /><span>{ui(touchPanning ? "Scroll page" : "Pan map")}</span></button>
        <button type="button" onClick={() => zoom(1.3)} aria-label="Zoom in"><Plus size={18} /></button>
        <button type="button" onClick={() => zoom(0.77)} aria-label="Zoom out"><Minus size={18} /></button>
        <button type="button" onClick={() => setView(fitView(prepared.projection, activeFocus))} aria-label="Reset map view"><LocateFixed size={18} /></button>
      </div>
      {hovered && !disabled && showHoverLabels && <div className="atlas-map-hint">{entities.find((entity) => entity.id === hovered)?.shortName}</div>}
    </div>
  );
}

export const AtlasWorldMap = memo(AtlasWorldMapComponent);
