/**
 * Region Builder's fixed region sets. Membership is by ISO 3166 alpha-3 code and never changes at runtime.
 * Where a region name is contested (the Balkans, the Sahel, Central America) the set uses an explicit,
 * citable definition and says so in `definition`, which the game shows to the player.
 * Tier 1 regions are small and well known; tier 3 regions are larger or less familiar.
 * `ambiguous` countries are sometimes counted in by other definitions, so they are never offered as wrong answers.
 */
export type RegionDefinition = { id: string; name: string; definition: string; tier: 1 | 2 | 3; members: string[]; ambiguous?: string[] };

export const REGIONS: RegionDefinition[] = [
  { id: "nordic", name: "The Nordic countries", definition: "Denmark, Finland, Iceland, Norway and Sweden.", tier: 1, members: ["DNK", "FIN", "ISL", "NOR", "SWE"] },
  { id: "baltic", name: "The Baltic states", definition: "The three states on the eastern Baltic coast.", tier: 1, members: ["EST", "LVA", "LTU"], ambiguous: ["FIN"] },
  { id: "benelux", name: "Benelux", definition: "Belgium, the Netherlands and Luxembourg.", tier: 1, members: ["BEL", "NLD", "LUX"] },
  { id: "iberia", name: "The Iberian Peninsula", definition: "Sovereign states on the peninsula.", tier: 1, members: ["ESP", "PRT", "AND"] },
  { id: "south_caucasus", name: "The South Caucasus", definition: "The three states south of the Greater Caucasus ridge.", tier: 1, members: ["ARM", "AZE", "GEO"], ambiguous: ["RUS", "TUR"] },
  { id: "central_asia", name: "Central Asia", definition: "UN M49 Central Asia.", tier: 1, members: ["KAZ", "KGZ", "TJK", "TKM", "UZB"], ambiguous: ["AFG", "MNG"] },
  { id: "visegrad", name: "The Visegrád Group", definition: "The four members of the V4 alliance.", tier: 1, members: ["CZE", "HUN", "POL", "SVK"] },
  { id: "horn_of_africa", name: "The Horn of Africa", definition: "Djibouti, Eritrea, Ethiopia and Somalia.", tier: 2, members: ["DJI", "ERI", "ETH", "SOM"], ambiguous: ["SDN", "SSD", "KEN"] },
  { id: "maghreb", name: "The Maghreb", definition: "Members of the Arab Maghreb Union.", tier: 2, members: ["DZA", "LBY", "MRT", "MAR", "TUN"] },
  { id: "arabian_peninsula", name: "The Arabian Peninsula", definition: "Sovereign states on the peninsula.", tier: 2, members: ["BHR", "KWT", "OMN", "QAT", "SAU", "ARE", "YEM"], ambiguous: ["JOR", "IRQ"] },
  { id: "former_yugoslavia", name: "The former Yugoslavia", definition: "UN members that emerged from Yugoslavia (the contested term “Balkans” is avoided).", tier: 2, members: ["BIH", "HRV", "MKD", "MNE", "SRB", "SVN"] },
  { id: "central_america", name: "Central America", definition: "The seven states of the isthmus, from Guatemala and Belize to Panama.", tier: 2, members: ["BLZ", "CRI", "SLV", "GTM", "HND", "NIC", "PAN"], ambiguous: ["MEX"] },
  { id: "andes", name: "The Andean countries", definition: "Countries the Andes mountain range runs through.", tier: 2, members: ["ARG", "BOL", "CHL", "COL", "ECU", "PER", "VEN"] },
  { id: "alps", name: "The Alpine countries", definition: "The eight states of the Alpine Convention.", tier: 2, members: ["AUT", "FRA", "DEU", "ITA", "LIE", "MCO", "SVN", "CHE"] },
  { id: "caspian", name: "The Caspian Sea coast", definition: "Countries with a Caspian shoreline.", tier: 2, members: ["AZE", "IRN", "KAZ", "RUS", "TKM"] },
  { id: "southeast_asia", name: "Southeast Asia", definition: "UN M49 South-eastern Asia.", tier: 2, members: ["BRN", "KHM", "IDN", "LAO", "MYS", "MMR", "PHL", "SGP", "THA", "TLS", "VNM"] },
  { id: "sacu", name: "The Southern African Customs Union", definition: "The five SACU member states.", tier: 3, members: ["BWA", "SWZ", "LSO", "NAM", "ZAF"] },
  { id: "sahel_g5", name: "The Sahel (G5 Sahel)", definition: "The five founding states of the G5 Sahel.", tier: 3, members: ["BFA", "TCD", "MLI", "MRT", "NER"] },
  { id: "caribbean", name: "The Caribbean", definition: "UN members in UN M49 Caribbean.", tier: 3, members: ["ATG", "BHS", "BRB", "CUB", "DMA", "DOM", "GRD", "HTI", "JAM", "KNA", "LCA", "VCT", "TTO"], ambiguous: ["BLZ", "GUY", "SUR"] },
  { id: "melanesia", name: "Melanesia", definition: "UN M49 Melanesia.", tier: 3, members: ["FJI", "PNG", "SLB", "VUT"], ambiguous: ["IDN", "TLS"] },
  { id: "micronesia", name: "Micronesia (region)", definition: "UN members in UN M49 Micronesia.", tier: 3, members: ["FSM", "KIR", "MHL", "NRU", "PLW"] },
  { id: "landlocked_africa", name: "Landlocked Africa", definition: "African countries without a coastline.", tier: 3, members: ["BWA", "BFA", "BDI", "CAF", "TCD", "ETH", "LSO", "MWI", "MLI", "NER", "RWA", "SSD", "SWZ", "UGA", "ZMB", "ZWE"] },
  { id: "mediterranean", name: "The Mediterranean coast", definition: "Countries with a Mediterranean shoreline.", tier: 3, members: ["ALB", "DZA", "BIH", "HRV", "CYP", "EGY", "FRA", "GRC", "ISR", "ITA", "LBN", "LBY", "MLT", "MCO", "MNE", "MAR", "PSE", "SVN", "ESP", "SYR", "TUN", "TUR"] },
  // Broad geographical groups let every one of the 195 countries appear as a correct member.
  { id: "continent_africa", name: "Africa", definition: "UN M49 Africa.", tier: 3,
    members: ["DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CPV", "CMR", "CAF", "TCD", "COM", "COD", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH", "GAB", "GMB", "GHA", "GIN", "GNB", "CIV", "KEN", "LSO", "LBR", "LBY", "MDG", "MWI", "MLI", "MRT", "MUS", "MAR", "MOZ", "NAM", "NER", "NGA", "COG", "RWA", "STP", "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO", "TUN", "UGA", "ZMB", "ZWE"] },
  { id: "continent_asia", name: "Asia", definition: "UN M49 Asia, including Palestine.", tier: 3,
    members: ["AFG", "ARM", "AZE", "BHR", "BGD", "BTN", "BRN", "KHM", "CHN", "CYP", "GEO", "IND", "IDN", "IRN", "IRQ", "ISR", "JPN", "JOR", "KAZ", "KWT", "KGZ", "LAO", "LBN", "MYS", "MDV", "MNG", "MMR", "NPL", "PRK", "OMN", "PAK", "PSE", "PHL", "QAT", "SAU", "SGP", "KOR", "LKA", "SYR", "TJK", "THA", "TLS", "TUR", "TKM", "ARE", "UZB", "VNM", "YEM"] },
  { id: "continent_europe", name: "Europe", definition: "UN M49 Europe, including the Holy See.", tier: 3,
    members: ["ALB", "AND", "AUT", "BLR", "BEL", "BIH", "BGR", "HRV", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "ISL", "IRL", "ITA", "LVA", "LIE", "LTU", "LUX", "MLT", "MDA", "MCO", "MNE", "MKD", "NOR", "POL", "PRT", "ROU", "RUS", "SMR", "SRB", "SVK", "SVN", "ESP", "SWE", "CHE", "NLD", "UKR", "GBR", "VAT"] },
  { id: "continent_north_america", name: "North America", definition: "UN M49 Northern America, Central America and Caribbean.", tier: 3,
    members: ["ATG", "BHS", "BRB", "BLZ", "CAN", "CRI", "CUB", "DMA", "DOM", "SLV", "GRD", "GTM", "HTI", "HND", "JAM", "MEX", "NIC", "PAN", "KNA", "LCA", "VCT", "TTO", "USA"] },
  { id: "continent_south_america", name: "South America", definition: "UN M49 South America.", tier: 3,
    members: ["ARG", "BOL", "BRA", "CHL", "COL", "ECU", "GUY", "PRY", "PER", "SUR", "URY", "VEN"] },
  { id: "continent_oceania", name: "Oceania", definition: "UN M49 Oceania.", tier: 3,
    members: ["AUS", "FJI", "KIR", "MHL", "FSM", "NRU", "NZL", "PLW", "PNG", "WSM", "SLB", "TON", "TUV", "VUT"] },
];
