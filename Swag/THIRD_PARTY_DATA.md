# Atlas Arena third-party data

Atlas Arena uses a versioned local snapshot. The application does not call these sources when a game starts. Run `npm run geography:sync` to rebuild `data/geography` and the optimized public snapshot.

| Source | Dataset/version | Fields consumed | License / attribution | Last sync |
| --- | --- | --- | --- | --- |
| Natural Earth | Admin-0 Countries, 1:110m, via `world-atlas` 2.0.2 | Simplified boundary geometry and M49 geometry IDs | Public domain; credit Natural Earth | See `data/geography/source-manifest.json` |
| UN Statistics Division | M49 online standard | M49, ISO alpha-2/3, country/area name, region and subregion | UN terms of use; source attribution retained | See manifest |
| GeoNames | `countryInfo.txt`, `cities15000.zip` | Names, capital, capital coordinates, language codes, currencies, neighbors, fallback population/area | CC BY 4.0; credit GeoNames | See manifest |
| World Bank | Indicators `SP.POP.TOTL` and `AG.SRF.TOTL.K2` | Latest available value, observation year and source metadata | CC BY 4.0; credit World Bank | See manifest |
| flag-icons | 7.5.0 | SVG country flags keyed by ISO alpha-2 | MIT, Copyright Panayiotis Lipiridis | Bundled dependency |

## Political and boundary policy

Natural Earth’s Admin-0 layer renders de facto boundaries. Atlas Arena keeps boundary rendering separate from play eligibility. The default `un195` scope consists of the 193 UN member states plus the Holy See and the State of Palestine. Territories stay in the snapshot under a separate scope. A rendered polygon is never silently promoted to a playable sovereign country.

UN M49 region assignments are statistical classifications and do not imply a position on political affiliation. Future disputed-boundary variants must add an explicit policy identifier rather than changing answers silently.
