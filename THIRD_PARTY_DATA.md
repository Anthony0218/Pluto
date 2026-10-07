# Atlas Arena third-party data

Atlas Arena uses a versioned local snapshot. The application does not call these sources when a game starts. Run `npm run geography:sync` to rebuild `data/geography` and the optimized public snapshot; `npm run geography:extras` refreshes only the cities and highest points (`extras.json`), and `npm run geography:history` only the History Battle facts (`history.json`). Denali (USA) is a hand fill-in because Wikidata lacks a normalized elevation for it.

| Source | Dataset/version | Fields consumed | License / attribution | Last sync |
| --- | --- | --- | --- | --- |
| Natural Earth | Admin-0 Countries, 1:110m, via `world-atlas` 2.0.2 | Simplified boundary geometry and M49 geometry IDs | Public domain; credit Natural Earth | See `data/geography/source-manifest.json` |
| UN Statistics Division | M49 online standard | M49, ISO alpha-2/3, country/area name, region and subregion | UN terms of use; source attribution retained | See manifest |
| GeoNames | `countryInfo.txt`, `cities15000.zip` | Names, capital, capital coordinates, language codes, currencies, neighbors, fallback population/area | CC BY 4.0; credit GeoNames | See manifest |
| World Bank | Indicators `SP.POP.TOTL` and `AG.SRF.TOTL.K2` | Latest available value, observation year and source metadata | CC BY 4.0; credit World Bank | See manifest |
| flag-icons | 7.5.0 | SVG country flags keyed by ISO alpha-2 | MIT, Copyright Panayiotis Lipiridis | Bundled dependency |
| GeoNames (extras) | `cities15000.zip` | Top 160 cities (≤ 5 per country): name, population, elevation (DEM), coordinates — Higher or Lower | CC BY 4.0; credit GeoNames | See `data/geography/extras.json` |
| Wikidata | SPARQL: country `P610` highest point with `P2044` elevation (normalized to metres) | Highest point name and elevation per UN member — Higher or Lower, Guess the Country | CC0 | See `data/geography/extras.json` |
| The World Factbook (CIA) | Final edition (retired February 2026), read from the [factbook.json](https://github.com/factbook/factbook.json) mirror pinned to commit `144d6977` | `Government > Independence` (dated events and the power a country became independent from), `Government > Country name > former`, and the opening sentences of `Introduction > Background` — History Battle | Public domain (US Government work; the JSON mirror is CC0). Credited as a courtesy; no endorsement by the CIA is implied and its seal is not used | See `data/geography/history.json` |
| World Bank Climate Change Knowledge Portal | Historical annual mean temperature, 1995–2014; country summaries for Russia, Sweden, Estonia, Colombia, Yemen and Guinea | Small curated climate deck for Extreme Geography | World Bank attribution; see country links below and [methodology](https://climateknowledgeportal.worldbank.org/metadata) | 2026-10-03 |

The Extreme Geography climate values come from these country pages: [Russia](https://climateknowledgeportal.worldbank.org/country/russian-federation), [Sweden](https://climateknowledgeportal.worldbank.org/country/sweden), [Estonia](https://climateknowledgeportal.worldbank.org/country/estonia), [Colombia](https://climateknowledgeportal.worldbank.org/sites/default/files/country-profiles/16698-WB_Colombia%20Country%20Profile-WEB.pdf), [Yemen](https://climateknowledgeportal.worldbank.org/sites/default/files/country-profiles/16696-WB_Yemen%20Country%20Profile-WEB.pdf), and [Guinea](https://climateknowledgeportal.worldbank.org/country/guinea).

## History Battle facts

`scripts/geography/sync-atlas-history.mjs` turns Factbook entries into questions without adding facts of its own. It keeps each dated entry of the Independence record (skipping approximate and B.C. dates), maps the Factbook's wording to an answer label through an explicit table (for example "League of Nations mandate under British administration" → United Kingdom), and keeps a former name only when it does not contain the country's present name, is not a government title ("People's Republic of …"), belongs to a single country and is not on a short skip list of ancient, shared or disputed names. Every power named anywhere in a country's Independence or Background entry is recorded as a tie, so it is never offered as a wrong answer for that country. The State of Palestine has no single Factbook profile and has no history questions.

## Political and boundary policy

Natural Earth’s Admin-0 layer renders de facto boundaries. Atlas Arena keeps boundary rendering separate from play eligibility. The default `un195` scope consists of the 193 UN member states plus the Holy See and the State of Palestine. Territories stay in the snapshot under a separate scope. A rendered polygon is never silently promoted to a playable sovereign country.

UN M49 region assignments are statistical classifications and do not imply a position on political affiliation. Future disputed-boundary variants must add an explicit policy identifier rather than changing answers silently.
