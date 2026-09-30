import { memo, useEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { LocateFixed, Minus, Plus } from "lucide-react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Coordinates, GeographicEntity } from "../../games/atlas/types";

type Props = {
  topology: unknown;
  entities: GeographicEntity[];
  onSelect?: (entityId: string) => void;
  onPoint?: (coordinates: Coordinates) => void;
  selectedId?: string | null;
  correctId?: string | null;
  incorrectId?: string | null;
  filledIds?: string[];
  ownership?: Record<string, "player_a" | "player_b">;
  disabled?: boolean;
  ariaLabel?: string;
  showHoverLabels?: boolean;
};

const WIDTH = 960, HEIGHT = 500;

function AtlasWorldMapComponent({ topology, entities, onSelect, onPoint, selectedId, correctId, incorrectId, filledIds = [], ownership = {}, disabled, ariaLabel = "Interactive world map", showHoverLabels = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const draggedRef = useRef(false);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const zoomAt = (factor: number, anchor: [number, number] = [WIDTH / 2, HEIGHT / 2]) => {
    setView((current) => {
      const scale = Math.max(1, Math.min(5, current.scale * factor));
      // Preserve the geographic point beneath the pointer as the map scales.
      const x = anchor[0] - (anchor[0] - current.x) * scale / current.scale;
      const y = anchor[1] - (anchor[1] - current.y) * scale / current.scale;
      return { x, y, scale };
    });
  };
  useEffect(() => {
    const map = svgRef.current;
    if (!map) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.18 : 0.84;
      const rectangle = map.getBoundingClientRect();
      zoomAt(factor, [
        (event.clientX - rectangle.left) * WIDTH / rectangle.width,
        (event.clientY - rectangle.top) * HEIGHT / rectangle.height,
      ]);
    };
    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, []);
  const prepared = useMemo(() => {
    const typed = topology as Topology<{ countries: GeometryCollection }>;
    const collection = feature(typed, typed.objects.countries) as unknown as FeatureCollection;
    const projection = geoEqualEarth().fitExtent([[18, 18], [WIDTH - 18, HEIGHT - 18]], collection);
    const path = geoPath(projection);
    const byGeometry = new Map(entities.filter((entity) => entity.geometryId).map((entity) => [entity.geometryId!, entity]));
    const shapes = collection.features.map((item: Feature<Geometry>, index) => {
      const geometryId = String(item.id).padStart(3, "0");
      return { key: `${geometryId}-${index}`, geometryId, path: path(item) || "", entity: byGeometry.get(geometryId) };
    });
    const smallEntities = entities.filter((entity) => entity.centroid && (!entity.geometryId || (entity.areaKm2?.value || 0) < 2500)).map((entity) => ({ entity, point: projection(entity.centroid!) })).filter((item) => item.point) as { entity: GeographicEntity; point: [number, number] }[];
    return { projection, shapes, smallEntities };
  }, [entities, topology]);

  const statusClass = (entityId?: string) => {
    if (!entityId) return "atlas-country atlas-country--unmapped";
    if (entityId === correctId) return "atlas-country atlas-country--correct";
    if (entityId === incorrectId) return "atlas-country atlas-country--incorrect";
    if (ownership[entityId]) return `atlas-country atlas-country--${ownership[entityId]}`;
    if (filledIds.includes(entityId)) return "atlas-country atlas-country--filled";
    if (entityId === selectedId) return "atlas-country atlas-country--selected";
    return "atlas-country";
  };

  const choose = (entity?: GeographicEntity) => {
    if (draggedRef.current) return;
    if (!disabled && entity) onSelect?.(entity.id);
  };
  const zoom = (factor: number) => zoomAt(factor);
  const pointerCoordinates = (event: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const rectangle = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - rectangle.left) * WIDTH / rectangle.width, (event.clientY - rectangle.top) * HEIGHT / rectangle.height];
  };

  return (
    <div className="atlas-map-shell">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={ariaLabel}
        onPointerDown={(event) => { const [x, y] = pointerCoordinates(event); draggedRef.current = false; dragRef.current = { x, y, originX: view.x, originY: view.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (!dragRef.current) return; const [x, y] = pointerCoordinates(event); const start = dragRef.current; if (Math.hypot(x - start.x, y - start.y) > 4) draggedRef.current = true; setView((current) => ({ ...current, x: start.originX + x - start.x, y: start.originY + y - start.y })); }}
        onPointerUp={(event) => { const start = dragRef.current; dragRef.current = null; if (start && !draggedRef.current) { const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target as Element; const entityId = target.closest<SVGElement>("[data-atlas-entity]")?.dataset.atlasEntity; if (entityId && !disabled) { draggedRef.current = true; onSelect?.(entityId); } else if (!entityId && onPoint) { const [x, y] = pointerCoordinates(event); const coordinate = prepared.projection.invert?.([(x - view.x) / view.scale, (y - view.y) / view.scale]); if (coordinate) onPoint(coordinate as Coordinates); } } window.setTimeout(() => { draggedRef.current = false; }, 0); }}>
        <defs><filter id="atlas-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <path d={geoPath(prepared.projection)({ type: "Sphere" }) || ""} className="atlas-ocean" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {prepared.shapes.map(({ key, path, entity }) => (
            <path key={key} d={path} data-atlas-entity={entity?.id} className={statusClass(entity?.id)} tabIndex={entity ? 0 : -1}
              aria-label={entity ? `Select ${entity.shortName}` : "Map entity unavailable for quiz play"}
              onClick={(event) => { event.stopPropagation(); choose(entity); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(entity); } }}
              onPointerEnter={() => entity && setHovered(entity.id)} onPointerLeave={() => setHovered(null)} />
          ))}
          {prepared.smallEntities.map(({ entity, point }) => (
            <g key={`marker-${entity.id}`} data-atlas-entity={entity.id} className={statusClass(entity.id)} transform={`translate(${point[0]} ${point[1]})`} onClick={(event) => { event.stopPropagation(); choose(entity); }}
              role="button" tabIndex={0} aria-label={`Select ${entity.shortName}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") choose(entity); }}>
              <circle r={11 / view.scale} className="atlas-hit-target" />
              <circle r={Math.max(2.4, 4 / view.scale)} className="atlas-microstate" />
            </g>
          ))}
        </g>
      </svg>
      <div className="atlas-map-controls" aria-label="Map controls">
        <button type="button" onClick={() => zoom(1.3)} aria-label="Zoom in"><Plus size={18} /></button>
        <button type="button" onClick={() => zoom(0.77)} aria-label="Zoom out"><Minus size={18} /></button>
        <button type="button" onClick={() => setView({ x: 0, y: 0, scale: 1 })} aria-label="Reset map view"><LocateFixed size={18} /></button>
      </div>
      {hovered && !disabled && showHoverLabels && <div className="atlas-map-hint">{entities.find((entity) => entity.id === hovered)?.shortName}</div>}
    </div>
  );
}

export const AtlasWorldMap = memo(AtlasWorldMapComponent);
