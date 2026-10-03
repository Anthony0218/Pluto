import { memo, useMemo } from "react";
import { geoAzimuthalEqualArea, geoCentroid, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

const SIZE = 320;

/** One country on its own, centred and scaled to fill the frame — no world map around it. */
function AtlasCountryShapeComponent({ topology, geometryId, label, showLabel = true }: { topology: unknown; geometryId: string; label: string; showLabel?: boolean }) {
  const path = useMemo(() => {
    const typed = topology as Topology<{ countries: GeometryCollection }>;
    const collection = feature(typed, typed.objects.countries) as unknown as FeatureCollection;
    const shape = collection.features.find((item: Feature<Geometry>) => String(item.id).padStart(3, "0") === geometryId);
    if (!shape) return "";
    // Centring the projection on the country keeps antimeridian countries (Russia, Fiji) in one piece.
    const [longitude, latitude] = geoCentroid(shape);
    const projection = geoAzimuthalEqualArea().rotate([-longitude, -latitude]).fitExtent([[16, 16], [SIZE - 16, SIZE - 16]], shape);
    return geoPath(projection)(shape) || "";
  }, [geometryId, topology]);
  return (
    <figure className="atlas-country-shape">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Outline of ${label}`}>
        <path d={path} />
      </svg>
      {showLabel && <figcaption>{label}</figcaption>}
    </figure>
  );
}

export const AtlasCountryShape = memo(AtlasCountryShapeComponent);
