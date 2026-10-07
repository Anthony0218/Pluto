// Builds the History Battle dataset (history.json) from The World Factbook's country profiles:
// the "Independence" entry (dated events), "Country name > former" and the opening of "Background".
// The Factbook is a US Government work in the public domain; the CIA retired it in February 2026, so this
// reads the final edition from the factbook.json mirror, pinned to one commit. Run after `geography:sync`.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outputDirectory = join(root, "data", "geography");
const publicDirectory = join(root, "public", "data", "geography");
const COMMIT = "144d6977b2b01ac1cbd220de754c0a005616760b";
const sources = {
  worldFactbook: "https://www.cia.gov/the-world-factbook/",
  factbookJson: `https://github.com/factbook/factbook.json/tree/${COMMIT}`,
  archive: `https://codeload.github.com/factbook/factbook.json/zip/${COMMIT}`,
};
const headers = { "User-Agent": "Pluto-Atlas-Arena/1.0 (geography quiz dataset sync)" };

const countries = JSON.parse(await readFile(join(outputDirectory, "countries.json"), "utf8")).filter((country) => country.status === "un195");
const { atlasDataVersion } = JSON.parse(await readFile(join(outputDirectory, "version.json"), "utf8"));

const response = await fetch(sources.archive, { headers });
if (!response.ok) throw new Error(`factbook.json: HTTP ${response.status}`);
const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
const decoder = new TextDecoder();
const profiles = Object.entries(archive)
  .filter(([path]) => /^[^/]+\/[a-z-]+\/[a-z]{2}\.json$/.test(path) && !/\/(meta|oceans|world|antarctica)\//.test(path))
  .map(([path, bytes]) => ({ gec: path.slice(-7, -5), profile: JSON.parse(decoder.decode(bytes)) }));

const ENTITIES = { rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", amp: "&", nbsp: " ", ndash: "–", mdash: "—", eacute: "é", quot: "\"" };
/** Factbook surnames are in capitals (Jomo KENYATTA); acronyms and regnal numbers stay as they are. */
const ACRONYMS = new Set(["UK", "US", "USA", "USSR", "UN", "EU", "NZ", "SFSR", "FRG", "GDR", "NATO", "AD", "BC", "WWI", "WWII", "UAE", "DRC", "PRC", "ROC", "OAS", "ANC", "CIS", "SSR", "ASEAN", "OPEC", "EEC", "SADR", "FLN", "PDRY", "YAR"]);
const clean = (value) => (typeof value === "string" ? value : "")
  .replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&([a-z]+);/g, (match, name) => ENTITIES[name] ?? match)
  .replace(/\b[A-Z]{2,}\b/g, (word) => ACRONYMS.has(word) || /^[IVXLC]+$/.test(word) ? word : word[0] + word.slice(1).toLowerCase())
  .replace(/\s+/g, " ").replace(/\s+([,;.)])/g, "$1").trim();
const text = (field) => clean(field?.text);
const key = (value) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z ]/g, " ")
  .replace(/\b(the|of|republic|state|federation)\b/g, " ").replace(/\s+/g, " ").trim();
const profileNames = (profile) => ["conventional short form", "conventional long form"].map((form) => text(profile.Government?.["Country name"]?.[form])).filter((name) => name && name !== "none");

// GEC codes differ from ISO, so profiles are matched by name; these four are spelled differently in the Atlas snapshot.
// The State of Palestine has no single Factbook profile (West Bank and Gaza Strip are separate) and is left out.
const GEC_OVERRIDES = { "country:CIV": "iv", "country:FSM": "fm", "country:MMR": "bm", "country:VAT": "vt" };
function profileFor(country) {
  if (GEC_OVERRIDES[country.id]) return profiles.find((item) => item.gec === GEC_OVERRIDES[country.id])?.profile ?? null;
  const keys = new Set([country.canonicalName, country.shortName, ...country.aliases].map(key));
  const hits = profiles.filter((item) => profileNames(item.profile).some((name) => keys.has(key(name))));
  return hits.length === 1 ? hits[0].profile : null;
}

/**
 * The power a country became independent from, as the Factbook phrases it → the name shown as an answer option.
 * `mention` finds every power named anywhere in a country's Independence or Background entry, so a question never
 * offers as a wrong answer a power (or a country) with a tie the Factbook itself records.
 */
const POWERS = {
  "United Kingdom": { phrases: ["the UK", "UK", "Great Britain", "UK protectorate status", "British India", "League of Nations mandate under British administration", "UK-administered UN trusteeship"], mention: /\bUK\b|Brit(?:ish|ain|ons)|Engl(?:ish|and)/ },
  France: { phrases: ["France", "French-administered UN trusteeship", "League of Nations mandate under French administration"], mention: /France|French|Franco/ },
  Spain: { phrases: ["Spain"], mention: /Spain|Spanish|Spaniard/ },
  Portugal: { phrases: ["Portugal"], mention: /Portug/ },
  Netherlands: { phrases: ["the Netherlands"], mention: /Netherlands|Dutch|Holland/ },
  Belgium: { phrases: ["Belgium", "UN trusteeship under Belgian administration", "Belgium-administered UN trusteeship"], mention: /Belgi/ },
  "Soviet Union": { phrases: ["the Soviet Union"], mention: /Soviet|USSR/ },
  Russia: { phrases: ["Russia", "Soviet Russia"], mention: /Russia/ },
  Yugoslavia: { phrases: ["Yugoslavia"], mention: /Yugoslav|Serbs, Croats/ },
  "Ottoman Empire": { phrases: ["the Ottoman Empire"], mention: /Ottoman|Turk/ },
  Japan: { phrases: ["Japan"], mention: /Japan/ },
  "United States": { phrases: ["the US", "US administration", "the US-administered UN trusteeship"], mention: /\bUS\b|United States/ },
  Colombia: { phrases: ["Colombia"], mention: /Colombia/ },
  Haiti: { phrases: ["Haiti"], mention: /Haiti/ },
  Brazil: { phrases: ["Brazil"], mention: /Brazil/ },
  Pakistan: { phrases: ["Pakistan"], mention: /Pakistan/ },
  Ethiopia: { phrases: ["Ethiopia"], mention: /Ethiopia/ },
  Sudan: { phrases: ["Sudan"], mention: /Sudan/ },
  China: { phrases: ["China"], mention: /China|Chinese|Qing/ },
  Indonesia: { phrases: ["Indonesia"], mention: /Indonesia/ },
  Denmark: { phrases: ["Denmark"], mention: /Denmark|Danish|Danes/ },
  Malaysia: { phrases: ["Malaysian Federation"], mention: /Malaysia|Malaya/ },
  "South Africa": { phrases: ["South African mandate"], mention: /South Africa/ },
  Australia: { phrases: ["the Australia-administered UN trusteeship"], mention: /Australia/ },
  "New Zealand": { phrases: ["New Zealand-administered UN trusteeship"], mention: /New Zealand|\bNZ\b/ },
  "Serbia and Montenegro": { phrases: ["the State Union of Serbia and Montenegro"], mention: /Serbia|Montenegr/ },
  "Holy Roman Empire": { phrases: ["the Holy Roman Empire"], mention: /Holy Roman/ },
};
const powerForPhrase = (phrase) => Object.keys(POWERS).find((power) => POWERS[power].phrases.includes(phrase)) ?? null;

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
// "12 December 1963 (from the UK)", "1839 (from the Netherlands)", "A.D. 884 (…)"; approximate (ca.) and B.C. dates are skipped.
const DATED = new RegExp(`(ca\\. )?(?:A\\.D\\. )?((?:\\d{1,2}(?:-\\d{1,2})? )?(?:(?:${MONTHS}) )?(\\d{3,4}))( B\\.C\\.)? \\(((?:[^()]|\\([^()]*\\))*)\\)`, "g");

function eventsFrom(record) {
  const events = [];
  for (const match of record.matchAll(DATED)) {
    const [, approximate, date, yearText, beforeChrist, body] = match;
    if (approximate || beforeChrist) continue;
    const year = Number(yearText), detail = body.split(";")[0].trim();
    let label = detail, from = null, declared = false;
    const declaration = detail.match(/^(?:declared|independence declared) from (.+)$/) ?? detail.match(/declared independence from (.+)$/);
    // Australia's entry reads "from the federation of UK colonies": the federation is the event, not a former ruler.
    if (/^from the federation of /.test(detail)) label = detail.slice(9);
    else if (/^from /.test(detail)) { from = detail.slice(5); label = `independence from ${from}`; }
    else if (declaration) { from = declaration[1]; declared = true; if (!/ declared independence from /.test(detail)) label = `independence declared from ${from}`; }
    else if (/independence from /.test(detail)) from = detail.split("independence from ")[1];
    // A bare "(declared)" or "(adopted by …)" does not say what happened; other years inside a label would muddle the question.
    if (label.split(" ").length < 2 || label.length > 110 || /\d{3,4}/.test(label) || /^(adopted|approved) by |^(as|following) /.test(label)) continue;
    const power = from ? powerForPhrase(from) : null;
    events.push({ year, date: date.trim(), label, ...(from ? { from } : {}), ...(power ? { power } : {}), ...(declared ? { declared } : {}) });
  }
  return events;
}

/** The record as shown after an answer: whole dated entries, up to roughly two lines. */
function shortRecord(record) {
  const parts = record.split(/; (?=(?:notable earlier dates?: )?(?:ca\. )?(?:A\.D\. )?\d)/);
  let result = parts[0];
  for (const part of parts.slice(1)) { if (`${result}; ${part}`.length > 230) break; result = `${result}; ${part}`; }
  return result.length > 260 ? `${result.slice(0, result.lastIndexOf(" ", 250))}…` : result;
}

/** The opening one or two sentences of the Background entry (abbreviations such as "A.D." do not end a sentence). */
function excerpt(background) {
  const guarded = background.replace(/ -- /g, " — ").replace(/\b(?:A\.D|B\.C|U\.S|St|Dr|Mt|Gen|ca|c)\./g, (match) => match.replaceAll(".", "\u0001"));
  const sentences = guarded.split(/(?<=[.!?])\s+(?=[A-Z"“])/);
  let result = "";
  for (const sentence of sentences) {
    const next = `${result} ${sentence.trim()}`.trim();
    if (result && next.length > 330) break;
    result = next;
    if (result.length > 170) break;
  }
  result = result.replaceAll("\u0001", ".");
  return result.length > 420 ? `${result.slice(0, result.lastIndexOf(" ", 400))}…` : result;
}

// Names of governments ("People's Republic of …") nearly always contain the country's name and make no question.
const REGIME = /Soviet Socialist Republic|People's Republic|Republic of|Kingdom of|State of|Federation of|Union of|Empire of|Sultanate of|Territory of|Protectorate in|Autonomous Region/;
// Ancient or shared names, the name of today's capital, and names tied to an open territorial dispute.
const SKIPPED_NAMES = new Set(["Quito", "Santo Domingo", "Ruanda-Urundi", "Urundi", "Senegambia", "Ifni", "Spanish Sahara", "Western Sahara", "Mandatory Palestine", "Nieuw Zeeland", "Netherlands New Guinea", "Sudanese Republic", "Awal", "Mishmahig", "Tylos", "Dilmun", "Serendib", "Mesopotamia", "Ruanda", "Mali Federation", "Italian East Africa", "British Central African Protectorate", "Trucial Oman", "British East Africa", "New Philippines", "Caroline Islands", "Marshall Islands District", "Palau District", "Ponape", "Truk", "and Yap Districts", "Kamerun"]);
const GENERIC = new Set(["republic", "kingdom", "people", "peoples", "socialist", "democratic", "federal", "state", "states", "union", "united", "islands", "island", "empire", "east", "west", "north", "south", "northern", "southern", "upper", "lower", "great", "greater", "saint", "protectorate", "territory", "province", "coast", "africa", "central", "trust", "free"]);
/** The Factbook's wording → the name most atlases print. */
const RENAMED = { "Netherlands East Indies": "Dutch East Indies" };
const tokens = (value) => key(value).split(" ").filter((token) => token.length >= 4 && !GENERIC.has(token));
function formerNamesFrom(raw, currentNames) {
  const current = currentNames.flatMap(tokens);
  const givesAway = (name) => tokens(name).some((token) => current.some((other) => token.includes(other) || other.includes(token) || token.slice(0, 5) === other.slice(0, 5)));
  const names = raw.replace(/\([^)]*\)/g, " ").split(/[,;]/).map((name) => name.replace(/\s+/g, " ").trim())
    .filter((name) => name && name !== "none" && !REGIME.test(name) && !SKIPPED_NAMES.has(name) && !givesAway(name)).map((name) => RENAMED[name] ?? name);
  // "Nyasaland Protectorate" adds nothing to "Nyasaland".
  return names.filter((name, index) => names.indexOf(name) === index && !names.some((other) => other !== name && name.includes(other)));
}

const history = {};
const unmatched = [];
for (const country of countries) {
  const profile = profileFor(country);
  if (!profile) { unmatched.push(country.shortName); continue; }
  const government = profile.Government ?? {};
  const record = text(government.Independence);
  const events = eventsFrom(record);
  const fullBackground = text(profile.Introduction?.Background), background = excerpt(fullBackground);
  const formerNames = formerNamesFrom(text(government["Country name"]?.former), [country.canonicalName, country.shortName, ...country.aliases, ...profileNames(profile)]);
  const mentions = Object.keys(POWERS).filter((power) => POWERS[power].mention.test(`${record} ${fullBackground}`));
  if (!events.length && !formerNames.length) continue;
  history[country.id] = { record: shortRecord(record), events, mentions, formerNames, background };
}
// A former name shared by several countries (German East Africa, United Arab Republic) has no single answer.
const nameCounts = new Map();
for (const entry of Object.values(history)) for (const name of entry.formerNames) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
for (const entry of Object.values(history)) entry.formerNames = entry.formerNames.filter((name) => nameCounts.get(name) === 1);

const output = {
  atlasDataVersion, synchronizedAt: new Date().toISOString(),
  source: { name: "The World Factbook (final edition, 2026)", publisher: "Central Intelligence Agency", license: "Public domain (US Government work)", commit: COMMIT, ...sources },
  countries: history,
};
await Promise.all([
  writeFile(join(outputDirectory, "history.json"), `${JSON.stringify(output, null, 2)}\n`),
  writeFile(join(publicDirectory, "history.json"), `${JSON.stringify(output)}\n`),
]);
const entries = Object.values(history);
console.log(`Atlas history ${atlasDataVersion}: ${entries.length} countries, ${entries.reduce((sum, entry) => sum + entry.events.length, 0)} dated events, ${entries.filter((entry) => entry.events.some((event) => event.power)).length} with a named former power, ${entries.reduce((sum, entry) => sum + entry.formerNames.length, 0)} former names. No profile: ${unmatched.join(", ") || "none"}.`);
