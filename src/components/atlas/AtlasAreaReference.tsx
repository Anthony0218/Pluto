import { areaReferenceCountry } from "@/games/atlas/areaReferences";
import { useAtlasData } from "@/games/atlas/useAtlasData";
import { AtlasCountryShape } from "./AtlasCountryShape";

export default function AtlasAreaReference({ values, excludeIds = [] }: { values: number[]; excludeIds?: string[] }) {
  const { data } = useAtlasData();
  if (!data || !values.length || !values.some(value => areaReferenceCountry(value, data.countries, excludeIds))) return null;
  const largest = Math.max(...values);
  return <section className="atlas-area-reference" aria-label="Area size comparison"><h3>Picture that area</h3><p>Approximate country-size references</p><div>{[...new Set(values)].map(value => {
    const country = areaReferenceCountry(value, data.countries, excludeIds);
    if (!country) return null;
    return <article key={value}><strong>{value.toLocaleString("en")} km²</strong><span>About the size of {country.shortName}</span><div style={{ width: `${Math.max(28, Math.sqrt(value / largest) * 100)}%` }}><AtlasCountryShape topology={data.topology} geometryId={country.geometryId!} label={country.shortName} showLabel={false} /></div><small>{country.shortName} · {Math.round(country.areaKm2!.value).toLocaleString("en")} km²</small></article>;
  })}</div></section>;
}
