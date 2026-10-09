import { FILL_SCOPES, focusForScope } from "../../games/atlas/scopes";
import { AtlasCountryShape } from "./AtlasCountryShape";
import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
import { geoEqualEarth, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LocateFixed, Minus, Plus } from "lucide-react";
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
  disabled?: boolean;
  ariaLabel?: string;
  showHoverLabels?: boolean;
  /** [south-west, north-east] corners to zoom to (Map Fill regions); reset returns here instead of the whole world. */
  focus?: [Coordinates, Coordinates] | null;
  confirmationKey?: string;
  /** Told which country is waiting for its confirming tap, so a panel beside the map can show the same prompt. */
  onPendingChange?: (pending: { id: string; label: string } | null) => void;
  /** Lets that panel confirm or cancel the waiting selection. */
  ref?: Ref<AtlasMapSelectionControl>;
};
export type AtlasMapSelectionControl = { confirm: () => void; cancel: () => void };

const WIDTH = 960, HEIGHT = 560, MAX_ZOOM = 16;
/** Share of the visible map one arrow press moves, and how long a button must be held before it moves continuously. */
const PAN_STEP = .35, HOLD_DELAY_MS = 280;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampView = (view:View):View => ({...view,x:Math.max(WIDTH-WIDTH*view.scale,Math.min(0,view.x)),y:Math.max(HEIGHT-HEIGHT*view.scale,Math.min(0,view.y))});
type View = { x: number; y: number; scale: number };
const WORLD: View = { x: 0, y: 0, scale: 1 };
const REGION_SHORT: Record<string, string> = { "North America": "N. America", "South America": "S. America" };

/** `view` zoomed by `factor` with the point under `anchor` (map units on screen) staying put. */
function zoomedView(view: View, factor: number, anchor: [number, number] = [WIDTH / 2, HEIGHT / 2]): View {
  const scale = clamp(view.scale * factor, 1, MAX_ZOOM);
  return clampView({ scale, x: anchor[0] - (anchor[0] - view.x) * scale / view.scale, y: anchor[1] - (anchor[1] - view.y) * scale / view.scale });
}

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
  const scale = clamp(Math.min(WIDTH / Math.max(1, maxX - minX), HEIGHT / Math.max(1, maxY - minY)) * .94, 1, MAX_ZOOM);
  return clampView({ scale, x: WIDTH / 2 - (minX + maxX) / 2 * scale, y: HEIGHT / 2 - (minY + maxY) / 2 * scale });
}

/** The two-finger gesture that starts from the first two pointers on the map. */
function pinchFrom(pointers: Map<number, [number, number]>, origin: View) {
  const [a, b] = [...pointers.values()];
  return { kind: "pinch" as const, distance: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number], origin };
}

/** A map control: one tap steps, holding it keeps moving or zooming until it is released. */
function HoldButton({ label, disabled, onStep, onMove, onHoldStart, children }: { label: string; disabled: boolean; onStep: () => void; onMove: (seconds: number) => void; onHoldStart: () => void; children: ReactNode }) {
  const hold = useRef({ timer: 0, frame: 0, running: false });
  const move = useRef(onMove), start = useRef(onHoldStart);
  useEffect(() => { move.current = onMove; start.current = onHoldStart; });
  const stop = useCallback(() => {
    const state = hold.current, ran = state.running;
    window.clearTimeout(state.timer); cancelAnimationFrame(state.frame);
    state.timer = 0; state.frame = 0; state.running = false;
    return ran;
  }, []);
  useEffect(() => {
    // A release outside the button (or losing the window) must not leave it running.
    const release = () => { stop(); };
    window.addEventListener("pointerup", release); window.addEventListener("pointercancel", release); window.addEventListener("blur", release);
    return () => { window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); window.removeEventListener("blur", release); stop(); };
  }, [stop]);
  return <button type="button" aria-label={label} title={label} aria-disabled={disabled}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      stop();
      hold.current.timer = window.setTimeout(() => {
        const state = hold.current; state.running = true; start.current();
        let last = performance.now();
        const frame = (now: number) => { move.current(Math.min(.05, (now - last) / 1000)); last = now; state.frame = requestAnimationFrame(frame); };
        state.frame = requestAnimationFrame(frame);
      }, HOLD_DELAY_MS);
    }}
    onPointerUp={() => { const pressed = hold.current.timer !== 0; if (!stop() && pressed) onStep(); }}
    onPointerLeave={() => { stop(); }}
    onClick={(event) => { if (event.detail === 0) onStep(); }}
    onContextMenu={(event) => event.preventDefault()}>{children}</button>;
}

function AtlasWorldMapComponent({ topology, entities, onSelect, onPoint, pins = [], selectedId, correctId, incorrectId, filledIds = [], disabled, ariaLabel = "Interactive world map", showHoverLabels = true, focus, confirmationKey = ariaLabel, onPendingChange, ref }: Props) {
  useUiLanguage();
  const [preview, setPreview] = useState<{ key: string; id: string } | null>(null);
  const pendingId = preview?.key === confirmationKey ? preview.id : null;
  const pendingLabel = pendingId ? (showHoverLabels ? entities.find(entity => entity.id === pendingId)?.shortName : "Country selected") : undefined;
  const promptVisible = Boolean(pendingId && !disabled && !onPoint);
  const reportPending = useRef(onPendingChange);
  useEffect(() => { reportPending.current = onPendingChange; });
  useEffect(() => { reportPending.current?.(promptVisible && pendingId ? { id: pendingId, label: pendingLabel ?? "Country selected" } : null); }, [promptVisible, pendingId, pendingLabel]);
  useImperativeHandle(ref, () => ({
    confirm: () => { if (pendingId) { setPreview(null); onSelect?.(pendingId); } },
    cancel: () => setPreview(null),
  }), [pendingId, onSelect]);
  const select = (id: string) => {
    if (disabled) return;
    if (pendingId === id) { setPreview(null); onSelect?.(id); }
    else setPreview({ key: confirmationKey, id });
  };
  const svgRef = useRef<SVGSVGElement>(null);
  /** Fingers or the mouse currently on the map (map units), and the one- or two-pointer gesture they make. */
  const pointersRef = useRef(new Map<number, [number, number]>());
  const gestureRef = useRef<{ kind: "pan"; x: number; y: number; origin: View; moved: boolean } | { kind: "pinch"; distance: number; mid: [number, number]; origin: View } | null>(null);
  const draggedRef = useRef(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [region,setRegion]=useState("Auto");
  const [cluster,setCluster]=useState<GeographicEntity[]>([]);
  /** Screen pixels per map unit; the map letterboxes inside its box, so this is not simply width / WIDTH. */
  const [pxPerUnit,setPxPerUnit]=useState(1);
  const activeFocus=region==="Auto"?focus:focusForScope(region);
  const pacific=Boolean(activeFocus&&activeFocus[1][0]>180);
  useEffect(()=>{const svg=svgRef.current;if(!svg)return;const measure=()=>{const matrix=svg.getScreenCTM();setPxPerUnit(matrix?.a||(svg.clientWidth||WIDTH)/WIDTH);};measure();const observer=new ResizeObserver(measure);observer.observe(svg);return ()=>observer.disconnect();},[]);
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
  const viewRef = useRef(view);
  const tweenRef = useRef(0);
  const targetRef = useRef<View | null>(null);
  useEffect(() => { viewRef.current = view; });
  const commit = (next: View) => { viewRef.current = next; setView(next); };
  const stopTween = () => { cancelAnimationFrame(tweenRef.current); tweenRef.current = 0; targetRef.current = null; };
  useEffect(() => () => { cancelAnimationFrame(tweenRef.current); }, []);
  // A new region re-frames the map (state adjusted while rendering, so there is no flash of the old view).
  const [framedFocus, setFramedFocus] = useState(focusKey);
  if (framedFocus !== focusKey) { setFramedFocus(focusKey); setView(fitView(prepared.projection, activeFocus)); }
  /** Glide to `target`; buttons and region changes use this, dragging and pinching write the view directly. */
  const animateTo = (target: View, duration = 220) => {
    cancelAnimationFrame(tweenRef.current);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { targetRef.current = null; commit(target); return; }
    const from = viewRef.current;
    let startedAt = -1;
    targetRef.current = target;
    const frame = (now: number) => {
      if (startedAt < 0) startedAt = now;
      const t = clamp((now - startedAt) / duration, 0, 1), eased = 1 - (1 - t) ** 3;
      commit({ x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased, scale: from.scale + (target.scale - from.scale) * eased });
      if (t < 1) tweenRef.current = requestAnimationFrame(frame); else { tweenRef.current = 0; targetRef.current = null; }
    };
    tweenRef.current = requestAnimationFrame(frame);
  };
  /** Where the view is heading, so quick repeated presses add up instead of restarting. */
  const baseView = () => targetRef.current ?? viewRef.current;
  const zoomAt = (factor: number, anchor?: [number, number]) => { stopTween(); commit(zoomedView(viewRef.current, factor, anchor)); };
  const stepZoom = (factor: number) => animateTo(zoomedView(baseView(), factor));
  /** dx/dy are -1, 0 or 1: the direction the window onto the map moves. */
  const panBy = (dx: number, dy: number, amount: number) => { const current = viewRef.current; commit(clampView({ ...current, x: current.x - dx * amount * WIDTH, y: current.y - dy * amount * HEIGHT })); };
  const stepPan = (dx: number, dy: number) => { const base = baseView(); animateTo(clampView({ ...base, x: base.x - dx * PAN_STEP * WIDTH, y: base.y - dy * PAN_STEP * HEIGHT })); };
  const resetView = () => animateTo(fitView(prepared.projection, activeFocus));
  const chooseRegion = (value: string) => {
    setCluster([]);
    const next = value === "Auto" ? focus : focusForScope(value), nextKey = next ? next.flat().join(",") : "";
    setRegion(value);
    // Same projection: glide there. A different one (Oceania wraps the date line) re-frames at once while rendering.
    if (Boolean(next && next[1][0] > 180) === pacific) { setFramedFocus(nextKey); animateTo(fitView(prepared.projection, next)); }
  };
  const zoomAtRef = useRef(zoomAt);
  useEffect(() => { zoomAtRef.current = zoomAt; });
  useEffect(() => {
    const map = svgRef.current;
    if (!map) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
      const matrix = map.getScreenCTM();
      if (!matrix) return;
      // Proportional to the scroll distance, so a trackpad glides and a wheel notch is a clear step.
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      zoomAtRef.current(Math.exp(-clamp(delta, -120, 120) * (event.ctrlKey ? .012 : .0022)), [point.x, point.y]);
    };
    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, []);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as Element).closest("select,input,textarea")) return;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) stepPan(...arrows[event.key]);
    else if (event.key === "+" || event.key === "=") stepZoom(1.6);
    else if (event.key === "-" || event.key === "_") stepZoom(1 / 1.6);
    else if (event.key === "0") resetView();
    else return;
    event.preventDefault();
  };

  const regionOptions = [...(focus ? [{ value: "Auto", label: "Start" }] : []), ...FILL_SCOPES.map(name => ({ value: name, label: name }))];
  const activeRegion = region === "Auto" && !focus ? "World" : region;
  const edge = .5, canGo = { left: view.x < -edge, right: view.x > WIDTH - WIDTH * view.scale + edge, up: view.y < -edge, down: view.y > HEIGHT - HEIGHT * view.scale + edge };

  const statusClass = (entityId?: string) => {
    if (!entityId) return "atlas-country atlas-country--unmapped";
    if (entityId === correctId) return "atlas-country atlas-country--correct";
    if (entityId === incorrectId) return "atlas-country atlas-country--incorrect";
    if (filledIds.includes(entityId)) return "atlas-country atlas-country--filled";
    if (entityId === (pendingId || selectedId)) return "atlas-country atlas-country--selected";
    return "atlas-country";
  };

  const choose = (entity?: GeographicEntity) => {
    if (draggedRef.current) return;
    if (!disabled && entity) {
      if (!onPoint) select(entity.id);
    }
  };
  const pointerCoordinates = (event: React.PointerEvent<SVGSVGElement>): [number, number] => {
    // SVG's aspect-ratio padding must not shift pins, especially on tall mobile maps.
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return [0, 0];
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  };

  return (
    <div className="atlas-map-shell" onKeyDown={handleKeyDown}>
      <svg ref={svgRef} className="atlas-map-canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={ariaLabel}
        onPointerDown={(event) => {
          stopTween();
          const point = pointerCoordinates(event), pointers = pointersRef.current;
          pointers.set(event.pointerId, point);
          event.currentTarget.setPointerCapture(event.pointerId);
          if (pointers.size === 1) { draggedRef.current = false; gestureRef.current = { kind: "pan", x: point[0], y: point[1], origin: viewRef.current, moved: false }; }
          else if (pointers.size === 2) { draggedRef.current = true; gestureRef.current = pinchFrom(pointers, viewRef.current); }
        }}
        onPointerMove={(event) => {
          const pointers = pointersRef.current, gesture = gestureRef.current;
          if (!pointers.has(event.pointerId)) return;
          const point = pointerCoordinates(event);
          pointers.set(event.pointerId, point);
          if (!gesture) return;
          if (gesture.kind === "pinch") {
            // Two fingers: zoom by how far apart they are and follow where they move together.
            const [a, b] = [...pointers.values()], distance = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const scale = clamp(gesture.origin.scale * distance / gesture.distance, 1, MAX_ZOOM);
            commit(clampView({ scale, x: mid[0] - (gesture.mid[0] - gesture.origin.x) * scale / gesture.origin.scale, y: mid[1] - (gesture.mid[1] - gesture.origin.y) * scale / gesture.origin.scale }));
            return;
          }
          const dx = point[0] - gesture.x, dy = point[1] - gesture.y;
          if (!gesture.moved) {
            // A tap that wobbles a few pixels is still a tap.
            if (Math.hypot(dx, dy) * pxPerUnit <= (event.pointerType === "mouse" ? 4 : 8)) return;
            gesture.moved = true; draggedRef.current = true;
          }
          commit(clampView({ ...gesture.origin, x: gesture.origin.x + dx, y: gesture.origin.y + dy }));
        }}
        onPointerCancel={(event) => {
          pointersRef.current.delete(event.pointerId); draggedRef.current = true;
          if (!pointersRef.current.size) gestureRef.current = null;
          else if (gestureRef.current?.kind === "pinch") { const [x, y] = [...pointersRef.current.values()][0]; gestureRef.current = { kind: "pan", x, y, origin: viewRef.current, moved: true }; }
        }}
        onPointerUp={(event) => {
          const pointers = pointersRef.current, gesture = gestureRef.current;
          pointers.delete(event.pointerId);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          if (pointers.size) {
            // One finger of a pinch lifted: carry on panning with the other.
            if (gesture?.kind === "pinch") { const [x, y] = [...pointers.values()][0]; gestureRef.current = { kind: "pan", x, y, origin: viewRef.current, moved: true }; }
            return;
          }
          gestureRef.current = null;
          const current = viewRef.current;
          if (gesture?.kind === "pan" && !gesture.moved && !draggedRef.current && !disabled) {
            draggedRef.current = true;
            if (onPoint) {
              const [x, y] = pointerCoordinates(event);
              const location: [number, number] = [(x - current.x) / current.scale, (y - current.y) / current.scale];
              const coordinate = prepared.projection.invert?.(location);
              const projected = coordinate && prepared.projection(coordinate);
              if (coordinate && coordinate.every(Number.isFinite) && Math.abs(coordinate[0]) <= 180 && Math.abs(coordinate[1]) <= 90
                && projected && Math.hypot(projected[0] - location[0], projected[1] - location[1]) < 1) onPoint(coordinate as Coordinates);
            } else {
              const [x,y]=pointerCoordinates(event);
              const nearby=prepared.smallEntities.filter(({point})=>Math.hypot(point[0]*current.scale+current.x-x,point[1]*current.scale+current.y-y)*pxPerUnit <= 18);
              if(nearby.length>1) {setCluster(nearby.map(item=>item.entity));return;}
              if(nearby.length===1){select(nearby[0].entity.id);return;}
              const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target as Element;
              const entityId = target.closest<SVGElement>("[data-atlas-entity]")?.dataset.atlasEntity;
              if (entityId) select(entityId);
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
              <circle r={18 / pxPerUnit / view.scale} className="atlas-hit-target" style={{pointerEvents:onPoint?"none":undefined}} />
              <circle r={Math.max(2.4, 4 / view.scale)} className="atlas-microstate" />
            </g>
          ))}
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
      {pendingId && !disabled && !onPoint && !onPendingChange && <div className="atlas-map-confirm" role="status"><span>{showHoverLabels ? entities.find(entity => entity.id === pendingId)?.shortName : "Country selected"} · tap again to confirm</span><button type="button" className="atlas-map-confirm-go" onClick={() => { setPreview(null); onSelect?.(pendingId); }}>Confirm selection</button><button type="button" aria-label="Cancel map selection" onClick={() => setPreview(null)}>×</button></div>}
      <div className="atlas-map-regions" role="group" aria-label={ui("Map region")}>
        {regionOptions.map(({ value, label }) => <button key={value} type="button" aria-label={ui(label)} aria-pressed={activeRegion === value} className={activeRegion === value ? "is-active" : undefined} onClick={() => chooseRegion(value)}>
          <span className="atlas-map-region-full">{ui(label)}</span><span className="atlas-map-region-short" aria-hidden="true">{ui(REGION_SHORT[label] ?? label)}</span>
        </button>)}
      </div>
      {view.scale>1.05&&<svg className="atlas-map-overview" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="World orientation overview" role="img">{prepared.shapes.map(shape=><path key={shape.key} d={shape.path}/>)}<rect x={-view.x/view.scale} y={-view.y/view.scale} width={WIDTH/view.scale} height={HEIGHT/view.scale}/></svg>}
      {cluster.length>1&&!disabled&&<div className="atlas-map-cluster" role="dialog" aria-label="Nearby small countries"><strong>Choose a small country</strong><p>Several markers overlap here. Zoom in or choose an outline.</p><div>{cluster.map((entity,index)=><button key={entity.id} onClick={()=>{select(entity.id);setCluster([]);}}>{entity.geometryId?<AtlasCountryShape topology={topology} geometryId={entity.geometryId} label={`Location ${index+1}`} showLabel={false}/>:<span>● {entity.centroid?.[1].toFixed(1)}°, {entity.centroid?.[0].toFixed(1)}°</span>}<span>{showHoverLabels?entity.shortName:`Location ${index+1}`}</span></button>)}</div><button onClick={()=>{const p=prepared.projection(cluster[0].centroid!);if(p)zoomAt(2,[p[0]*view.scale+view.x,p[1]*view.scale+view.y]);setCluster([]);}}>Zoom to markers</button><button onClick={()=>setCluster([])}>Close</button></div>}
      <div className="atlas-map-controls" role="group" aria-label={ui("Map controls")}>
        <div className="atlas-map-zoom">
          <HoldButton label={ui("Zoom out")} disabled={view.scale <= 1.01} onStep={() => stepZoom(1 / 1.6)} onMove={seconds => zoomAt(Math.exp(-1.7 * seconds))} onHoldStart={stopTween}><Minus size={18} /></HoldButton>
          <HoldButton label={ui("Zoom in")} disabled={view.scale >= MAX_ZOOM - .01} onStep={() => stepZoom(1.6)} onMove={seconds => zoomAt(Math.exp(1.7 * seconds))} onHoldStart={stopTween}><Plus size={18} /></HoldButton>
        </div>
        <div className="atlas-map-arrows">
          <HoldButton label={ui("Move map left")} disabled={!canGo.left} onStep={() => stepPan(-1, 0)} onMove={seconds => panBy(-1, 0, .9 * seconds)} onHoldStart={stopTween}><ArrowLeft size={18} /></HoldButton>
          <HoldButton label={ui("Move map up")} disabled={!canGo.up} onStep={() => stepPan(0, -1)} onMove={seconds => panBy(0, -1, .9 * seconds)} onHoldStart={stopTween}><ArrowUp size={18} /></HoldButton>
          <HoldButton label={ui("Move map down")} disabled={!canGo.down} onStep={() => stepPan(0, 1)} onMove={seconds => panBy(0, 1, .9 * seconds)} onHoldStart={stopTween}><ArrowDown size={18} /></HoldButton>
          <HoldButton label={ui("Move map right")} disabled={!canGo.right} onStep={() => stepPan(1, 0)} onMove={seconds => panBy(1, 0, .9 * seconds)} onHoldStart={stopTween}><ArrowRight size={18} /></HoldButton>
        </div>
        <button type="button" className="atlas-map-reset" onClick={resetView} aria-label={ui("Reset map view")} title={ui("Reset map view")}><LocateFixed size={18} /></button>
      </div>
      {hovered && !disabled && showHoverLabels && <div className="atlas-map-hint">{entities.find((entity) => entity.id === hovered)?.shortName}</div>}
    </div>
  );
}

export const AtlasWorldMap = memo(AtlasWorldMapComponent);
