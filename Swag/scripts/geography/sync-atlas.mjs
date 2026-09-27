import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outputDirectory = join(root, "data", "geography");
const publicDirectory = join(root, "public", "data", "geography");
const version = process.env.ATLAS_DATA_VERSION || new Date().toISOString().slice(0, 7);
const synchronizedAt = new Date().toISOString();

const sources = {
  unM49: "https://unstats.un.org/unsd/methodology/m49/overview/",
  geonamesCountries: "https://download.geonames.org/export/dump/countryInfo.txt",
  geonamesCities: "https://download.geonames.org/export/dump/cities15000.zip",
  flags: "https://github.com/lipis/flag-icons/tree/v7.5.0",
  population: "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&mrnev=1",
  area: "https://api.worldbank.org/v2/country/all/indicator/AG.SRF.TOTL.K2?format=json&per_page=20000&mrnev=1",
};

const unMembers = new Set(`AFG ALB DZA AND AGO ATG ARG ARM AUS AUT AZE BHS BHR BGD BRB BLR BEL BLZ BEN BTN BOL BIH BWA BRA BRN BGR BFA BDI CPV KHM CMR CAN CAF TCD CHL CHN COL COM COG COD CRI CIV HRV CUB CYP CZE PRK DNK DJI DMA DOM ECU EGY SLV GNQ ERI EST SWZ ETH FJI FIN FRA GAB GMB GEO DEU GHA GRC GRD GTM GIN GNB GUY HTI HND HUN ISL IND IDN IRN IRQ IRL ISR ITA JAM JPN JOR KAZ KEN KIR KWT KGZ LAO LVA LBN LSO LBR LBY LIE LTU LUX MDG MWI MYS MDV MLI MLT MHL MRT MUS MEX FSM MDA MCO MNG MNE MAR MOZ MMR NAM NRU NPL NLD NZL NIC NER NGA MKD NOR OMN PAK PLW PAN PNG PRY PER PHL POL PRT QAT KOR ROU RUS RWA KNA LCA VCT WSM SMR STP SAU SEN SRB SYC SLE SGP SVK SVN SLB SOM ZAF SSD ESP LKA SDN SUR SWE CHE SYR TJK THA TLS TGO TON TTO TUN TUR TKM TUV UGA UKR ARE GBR TZA USA URY UZB VUT VEN VNM YEM ZMB ZWE PSE VAT`.split(" "));

const fetchText = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": "Pluto-Atlas-Arena/1.0" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
};

const fetchBytes = async (url) => {
  const response = await fetch(url, { headers: { "User-Agent": "Pluto-Atlas-Arena/1.0" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ""));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function decodeHtml(value) {
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&([a-zA-Z]+);/g, (_, name) => ({ eacute: "é", ocirc: "ô", rsquo: "’" }[name] || ""))
    .replace(/\s+/g, " ").trim();
}

function parseM49(text) {
  if (!text.trimStart().startsWith("<")) return parseCsv(text);
  const table = text.match(/<table[^>]*id\s*=\s*["']?downloadTableEN["']?[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error("UN M49 English download table was not found.");
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1])),
  ).filter((row) => row.length >= 12);
  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function parseGeonamesCountries(text) {
  const byIso3 = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const fields = line.split("\t");
    byIso3.set(fields[1], {
      iso2: fields[0], iso3: fields[1], m49: fields[2].padStart(3, "0"), canonicalName: fields[4],
      capital: fields[5], area: Number(fields[6]) || null, population: Number(fields[7]) || null,
      continentCode: fields[8], currencyCode: fields[10], currencyName: fields[11],
      languageCodes: fields[15] ? fields[15].split(",") : [], neighbors: fields[17] ? fields[17].split(",") : [],
    });
  }
  return byIso3;
}

function parseCapitalCoordinates(bytes) {
  const files = unzipSync(bytes);
  const entry = Object.entries(files).find(([name]) => name.endsWith(".txt"));
  if (!entry) throw new Error("GeoNames cities archive did not contain a text file.");
  const byCountry = new Map();
  for (const line of new TextDecoder().decode(entry[1]).split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split("\t");
    if (!fields[7]?.startsWith("PPLC")) continue;
    const candidate = { name: fields[1], aliases: fields[3]?.split(",") || [], coordinates: [Number(fields[5]), Number(fields[4])], kind: fields[7] };
    const existing = byCountry.get(fields[8]);
    if (!existing || candidate.kind === "PPLC") byCountry.set(fields[8], candidate);
  }
  return byCountry;
}

function latestObservations(payload) {
  const [, rows = []] = payload;
  const result = new Map();
  for (const row of rows) {
    if (!row.countryiso3code || !row.value || result.has(row.countryiso3code)) continue;
    result.set(row.countryiso3code, { value: Number(row.value), year: Number(row.date), source: "World Bank", sourceUpdatedAt: synchronizedAt });
  }
  return result;
}

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const displayLanguage = (code) => {
  const normalized = code.split("-")[0].toLowerCase();
  try { return languageNames.of(normalized) || code; } catch { return code; }
};
const displayCurrency = (code, fallback) => {
  try { return currencyNames.of(code) || fallback || code; } catch { return fallback || code; }
};

await mkdir(outputDirectory, { recursive: true });
await mkdir(publicDirectory, { recursive: true });

const [m49Text, geonamesText, citiesZip, populationPayload, areaPayload] = await Promise.all([
  fetchText(sources.unM49), fetchText(sources.geonamesCountries), fetchBytes(sources.geonamesCities),
  fetchText(sources.population).then(JSON.parse), fetchText(sources.area).then(JSON.parse),
]);

const m49Rows = parseM49(m49Text);
const geonames = parseGeonamesCountries(geonamesText);
const iso3ByIso2 = new Map([...geonames.values()].map((country) => [country.iso2, country.iso3]));
const capitals = parseCapitalCoordinates(citiesZip);
const populations = latestObservations(populationPayload);
const areas = latestObservations(areaPayload);
const topology = JSON.parse(await readFile(join(root, "node_modules", "world-atlas", "countries-110m.json"), "utf8"));
const geometryIds = new Set(topology.objects.countries.geometries.map((geometry) => String(geometry.id).padStart(3, "0")));

const countries = m49Rows.filter((row) => row["ISO-alpha3 Code"]).map((row) => {
  const iso3 = row["ISO-alpha3 Code"];
  const iso2 = row["ISO-alpha2 Code"];
  const m49 = row["M49 Code"].padStart(3, "0");
  const geo = geonames.get(iso3);
  const capital = capitals.get(iso2);
  const capitalCoordinates = capital?.coordinates || null;
  const centroid = capitalCoordinates;
  const continent = row["Region Name"] === "Americas"
    ? (row["Sub-region Name"] === "South America" ? "South America" : "North America")
    : row["Region Name"] || "Other";
  // GeoNames exposes useful fallback values but no observation year. Atlas
  // intentionally omits them here rather than presenting an undated statistic.
  const population = populations.get(iso3) || null;
  const areaKm2 = areas.get(iso3) || null;
  return {
    id: `country:${iso3}`, entityType: "country", iso2, iso3, m49,
    canonicalName: row["Country or Area"], shortName: geo?.canonicalName || row["Country or Area"],
    aliases: [], continent,
    subregion: row["Intermediate Region Name"] || row["Sub-region Name"] || "",
    capitalCities: capital?.name ? [capital.name] : geo?.capital ? [geo.capital] : [],
    officialLanguages: [...new Set((geo?.languageCodes || []).map(displayLanguage))],
    currencies: geo?.currencyCode ? [{ code: geo.currencyCode, name: displayCurrency(geo.currencyCode, geo.currencyName) }] : [],
    population, areaKm2, neighbors: (geo?.neighbors || []).map((neighbor) => iso3ByIso2.get(neighbor)).filter(Boolean).map((neighbor) => `country:${neighbor}`),
    flagAsset: iso2 ? `/flags/4x3/${iso2.toLowerCase()}.svg` : null,
    centroid, capitalCoordinates,
    geometryId: geometryIds.has(m49) ? m49 : null,
    playable: unMembers.has(iso3), status: unMembers.has(iso3) ? "un195" : "territory",
    dataVersion: version,
    sources: ["UN M49", "Natural Earth", "GeoNames", "flag-icons", ...(population ? [population.source] : []), ...(areaKm2 ? [areaKm2.source] : [])],
  };
}).sort((left, right) => left.shortName.localeCompare(right.shortName));

const manifest = {
  atlasDataVersion: version, synchronizedAt,
  entityCount: countries.length, playableUn195Count: countries.filter((country) => country.playable).length,
  sources,
  geometry: { source: "Natural Earth via world-atlas", version: "Natural Earth 110m / world-atlas package", boundaryPolicy: "de facto rendering; gameplay scope is independently configured" },
};

await Promise.all([
  writeFile(join(outputDirectory, "countries.json"), `${JSON.stringify(countries, null, 2)}\n`),
  writeFile(join(outputDirectory, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(join(outputDirectory, "version.json"), `${JSON.stringify({ atlasDataVersion: version, synchronizedAt }, null, 2)}\n`),
  writeFile(join(outputDirectory, "world-110m.json"), `${JSON.stringify(topology)}\n`),
  writeFile(join(publicDirectory, "countries.json"), `${JSON.stringify(countries)}\n`),
  writeFile(join(publicDirectory, "world-110m.json"), `${JSON.stringify(topology)}\n`),
  writeFile(join(publicDirectory, "version.json"), `${JSON.stringify({ atlasDataVersion: version, synchronizedAt })}\n`),
  cp(join(root, "node_modules", "flag-icons", "flags", "4x3"), join(root, "public", "flags", "4x3"), { recursive: true }),
]);

console.log(`Atlas ${version}: wrote ${countries.length} entities (${countries.filter((country) => country.playable).length} in un195 scope).`);
