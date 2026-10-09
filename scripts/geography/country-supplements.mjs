// Sourced fallbacks for gaps in World Bank, GeoNames and the Factbook date parser.
// Keep these in the sync pipeline as well as the checked-in snapshots.
export const FACTBOOK_COMMIT = "144d6977b2b01ac1cbd220de754c0a005616760b";
const factbook = (path) => `https://github.com/factbook/factbook.json/blob/${FACTBOOK_COMMIT}/${path}.json`;
export const SUPPLEMENT_SOURCES = {
  vaticanPopulation: "https://www.vaticanstate.va/en/state-and-government/general-informations/population.html",
  vaticanArea: "https://www.vaticanstate.va/en/state-and-government/general-informations/geography.html",
  israelCapital: "https://www.geonames.org/281184/jerusalem.html",
  palestineCapital: "https://www.geonames.org/7303419/east-jerusalem.html",
  gambiaHighestPoint: factbook("africa/ga"),
  palestineHistory: "https://www.un.org/unispal/document/auto-insert-187149/",
};

export function applyCountrySupplements(countries, synchronizedAt) {
  for (const country of countries) {
    if (country.iso3 === "VAT") {
      country.population ??= { value: 882, year: 2024, source: "Vatican City State", sourceUpdatedAt: synchronizedAt };
      // The official geographic description is undated; year denotes the verified snapshot year.
      country.areaKm2 ??= { value: 0.44, year: 2026, source: "Vatican City State (geography, verified 2026)", sourceUpdatedAt: synchronizedAt };
      country.sources = [...new Set([...country.sources, country.population.source, country.areaKm2.source])];
    }
    // These cities are not PPLC entries in GeoNames, so cities15000's capital filter omits them.
    const capital = country.iso3 === "ISR" ? [35.21633, 31.76904]
      : country.iso3 === "PSE" ? [35.2338838577271, 31.7833596083705] : null;
    if (capital) {
      country.capitalCoordinates ??= capital;
      country.centroid ??= capital;
    }
  }
  return countries;
}

export const HIGHEST_POINT_SUPPLEMENTS = {
  "country:GMB": { name: "Unnamed elevation southeast of Sabi", elevationM: 63, source: "The World Factbook", sourceUrl: SUPPLEMENT_SOURCES.gambiaHighestPoint },
};

const entry = (record, events, mentions = []) => ({ record, events, mentions, formerNames: [], background: "" });
// Dates and descriptions checked against the pinned Factbook Independence entries, including their notes.
// Explicit labels keep founding/recognition events distinct from independence from a former ruler.
export const HISTORY_SUPPLEMENTS = {
  "country:ISR": entry("14 May 1948: declaration of independence following the League of Nations mandate under British administration.",
    [{ year: 1948, date: "14 May 1948", label: "declaration of independence following the British-administered mandate" }], ["United Kingdom"]),
  "country:ITA": entry("17 March 1861: proclamation of the Kingdom of Italy; full unification followed in 1871.",
    [{ year: 1861, date: "17 March 1861", label: "proclamation of the Kingdom of Italy" }]),
  "country:LBR": entry("26 July 1847: declaration of independence.",
    [{ year: 1847, date: "26 July 1847", label: "declaration of independence" }], ["United States"]),
  "country:SOM": entry("1 July 1960: British Somaliland and Italian Somaliland merged to form the Somali Republic after independence.",
    [{ year: 1960, date: "1 July 1960", label: "formation of the Somali Republic by the merger of British and Italian Somaliland" }], ["United Kingdom", "Italy"]),
  "country:ESP": entry("1492: seizure of Granada, traditionally considered the completion of the unification that forged present-day Spain.",
    [{ year: 1492, date: "1492", label: "seizure of Granada completing the traditional unification of Spain" }]),
  "country:NLD": entry("26 July 1581: declaration of independence through the Act of Abjuration; Spain recognized independence on 30 January 1648.",
    [{ year: 1581, date: "26 July 1581", label: "independence declared from Spain", from: "Spain", power: "Spain", declared: true },
      { year: 1648, date: "30 January 1648", label: "recognition of independence by Spain" }], ["Spain"]),
  "country:VAT": entry("11 February 1929: the Lateran treaties with Italy acknowledged the sovereignty of the Holy See and established Vatican City State.",
    [{ year: 1929, date: "11 February 1929", label: "establishment of Vatican City State through the Lateran treaties" }], ["Italy"]),
  // The Factbook has separate West Bank/Gaza profiles. Use the UN's own dated event for Palestine.
  "country:PSE": {
    ...entry("29 November 2012: the United Nations General Assembly accorded Palestine non-member observer State status in resolution 67/19.",
      [{ year: 2012, date: "29 November 2012", label: "granting of non-member observer State status at the United Nations" }]),
    source: { name: "United Nations General Assembly, resolution 67/19", url: SUPPLEMENT_SOURCES.palestineHistory },
  },
};
