// Adds the sourced extras that Atlas Higher/Lower and Guess the Country use on top of
// countries.json: major cities (GeoNames cities15000) and each country's highest point
// (Wikidata P610 + P2044). Run after `geography:sync`; it reads the synced countries.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outputDirectory = join(root, "data", "geography");
const publicDirectory = join(root, "public", "data", "geography");
const sources = {
  geonamesCities: "https://download.geonames.org/export/dump/cities15000.zip",
  wikidataHighestPoints: "https://query.wikidata.org/sparql",
};
const CITY_COUNT = 160, CITIES_PER_COUNTRY = 5;

const headers = { "User-Agent": "Pluto-Atlas-Arena/1.0 (geography quiz dataset sync)" };
const countries = JSON.parse(await readFile(join(outputDirectory, "countries.json"), "utf8"));
const { atlasDataVersion } = JSON.parse(await readFile(join(outputDirectory, "version.json"), "utf8"));
const byIso2 = new Map(countries.filter((country) => country.status === "un195").map((country) => [country.iso2, country]));
const byIso3 = new Map(countries.filter((country) => country.status === "un195").map((country) => [country.iso3, country]));

const cityResponse = await fetch(sources.geonamesCities, { headers });
if (!cityResponse.ok) throw new Error(`cities15000: HTTP ${cityResponse.status}`);
const archive = unzipSync(new Uint8Array(await cityResponse.arrayBuffer()));
const cityRows = new TextDecoder().decode(archive["cities15000.txt"]).split("\n").filter(Boolean).map((line) => line.split("\t"));
const perCountry = new Map();
const cities = cityRows
  .map((columns) => ({ geonameId: columns[0], name: columns[1], latitude: Number(columns[4]), longitude: Number(columns[5]), featureCode: columns[7], iso2: columns[8], population: Number(columns[14]), elevation: Number(columns[15] || columns[16]) }))
  .filter((city) => byIso2.has(city.iso2) && city.population > 0 && city.featureCode.startsWith("PPL"))
  .sort((left, right) => right.population - left.population)
  .filter((city) => { const count = perCountry.get(city.iso2) || 0; if (count >= CITIES_PER_COUNTRY) return false; perCountry.set(city.iso2, count + 1); return true; })
  .slice(0, CITY_COUNT)
  .map((city) => ({ id: `city:${city.geonameId}`, name: city.name, countryId: byIso2.get(city.iso2).id, population: city.population, elevationM: Number.isFinite(city.elevation) ? Math.round(city.elevation) : null, coordinates: [city.longitude, city.latitude], capital: city.featureCode === "PPLC" }));

const query = `SELECT ?iso3 ?pointLabel ?elevation WHERE {
  ?country wdt:P298 ?iso3; wdt:P610 ?point.
  ?point p:P2044/psn:P2044/wikibase:quantityAmount ?elevation.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
const wikidata = await fetch(`${sources.wikidataHighestPoints}?format=json&query=${encodeURIComponent(query)}`, { headers: { ...headers, Accept: "application/sparql-results+json" } });
if (!wikidata.ok) throw new Error(`Wikidata: HTTP ${wikidata.status}`);
const highestPoints = {};
for (const row of (await wikidata.json()).results.bindings) {
  const country = byIso3.get(row.iso3.value), elevationM = Math.round(Number(row.elevation.value)), name = row.pointLabel.value;
  // Several statements can exist per country (old surveys, disputed peaks): keep the highest named one.
  if (!country || !Number.isFinite(elevationM) || /^Q\d+$/.test(name)) continue;
  if (!highestPoints[country.id] || highestPoints[country.id].elevationM < elevationM) highestPoints[country.id] = { name, elevationM };
}

// Fill-ins for countries whose Wikidata highest point has no normalized elevation statement.
const FILL_INS = { "country:USA": { name: "Denali", elevationM: 6190 } };
for (const [id, point] of Object.entries(FILL_INS)) highestPoints[id] ??= point;

const extras = { atlasDataVersion, synchronizedAt: new Date().toISOString(), sources, cities, highestPoints };
await Promise.all([
  writeFile(join(outputDirectory, "extras.json"), `${JSON.stringify(extras, null, 2)}\n`),
  writeFile(join(publicDirectory, "extras.json"), `${JSON.stringify(extras)}\n`),
]);
console.log(`Atlas extras ${atlasDataVersion}: ${cities.length} cities, ${Object.keys(highestPoints).length} highest points.`);
