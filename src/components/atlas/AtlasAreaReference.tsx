import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { areaReferenceCountry } from "@/games/atlas/areaReferences";
import { useAtlasData } from "@/games/atlas/useAtlasData";
import { AtlasCountryShape } from "./AtlasCountryShape";

export default function AtlasAreaReference({ values, excludeIds = [] }: { values: number[]; excludeIds?: string[] }) {
  useGameLanguage();
  const { data } = useAtlasData();
  if (!data || !values.length || !values.some(value => areaReferenceCountry(value, data.countries, excludeIds))) return null;
  const largest = Math.max(...values);
  return <section className="atlas-area-reference" aria-label={gameUi("Area size comparison")}><h3>{gameUi("Picture that area")}</h3><p>{gameUi("Approximate country-size references")}</p><div>{[...new Set(values)].map(value => {
    const country = areaReferenceCountry(value, data.countries, excludeIds);
    if (!country) return null;
    return <article key={value}><strong>{gameUi(value.toLocaleString("en"))}{gameUi(" km²")}</strong><span>{gameUi("About the size of ")}{gameUi(country.shortName)}</span><div style={{ width: `${Math.max(28, Math.sqrt(value / largest) * 100)}%` }}><AtlasCountryShape topology={data.topology} geometryId={country.geometryId!} label={gameUi(country.shortName)} showLabel={false} /></div><small>{gameUi(country.shortName)} · {gameUi(Math.round(country.areaKm2!.value).toLocaleString("en"))}{gameUi(" km²")}</small></article>;
  })}</div></section>;
}
