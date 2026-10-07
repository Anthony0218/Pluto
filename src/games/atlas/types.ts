import type { CountryHintKind } from "./countryHints.ts";

export type AtlasDifficulty = "beginner" | "intermediate" | "expert";
export type AtlasScope = "un195" | "territories" | "all_map_entities";
export type AtlasCategory = "countries" | "locations" | "capitals" | "flags" | "population" | "area" | "continents" | "languages" | "borders" | "currency" | "statistics" | "clues";
export type AtlasInteraction = "single_choice" | "multi_select" | "map_click" | "closest_click" | "higher_lower" | "map_fill" | "guess_country";
export type AtlasMode = "map_click" | "closest_wins" | "speed_run" | "map_fill" | "flags" | "higher_lower" | "guess_country";

export type SourcedNumber = { value: number; year: number; source: string; sourceUpdatedAt: string };
export type Coordinates = [longitude: number, latitude: number];

export type GeographicEntity = {
  id: string;
  entityType: "country" | "continent" | "region" | "city";
  iso2: string;
  iso3: string;
  m49: string;
  canonicalName: string;
  shortName: string;
  aliases: string[];
  continent: string;
  subregion: string;
  capitalCities: string[];
  officialLanguages: string[];
  currencies: { code: string; name: string }[];
  population: SourcedNumber | null;
  areaKm2: SourcedNumber | null;
  neighbors: string[];
  flagAsset: string | null;
  centroid: Coordinates | null;
  capitalCoordinates: Coordinates | null;
  geometryId: string | null;
  playable: boolean;
  status: "un195" | "territory" | "disputed";
  dataVersion: string;
  sources: string[];
};

type QuestionBase = {
  id: string;
  seed: string;
  entityId: string;
  entityType: GeographicEntity["entityType"];
  category: AtlasCategory;
  property?: string;
  difficulty: AtlasDifficulty;
  scope: AtlasScope;
  prompt: string;
  sourceMetadata: { source: string; year?: number }[];
};

export type ChoiceQuestion = QuestionBase & {
  interaction: "single_choice";
  answer: string;
  choices: { id: string; label: string; flagAsset?: string | null }[];
  targetGeometryId?: string | null;
  /** Flag quiz: the flag to identify, or the lone country silhouette (geometry) and name whose flag is wanted. */
  promptFlagAsset?: string | null;
  promptShape?: { geometryId: string; label: string } | null;
  /** Shown with the answer once it is graded (the record behind a History Battle question). */
  explanation?: string;
};

export type MultiSelectQuestion = QuestionBase & {
  interaction: "multi_select";
  answer: string[];
  choices: { id: string; label: string }[];
};

export type MapClickQuestion = QuestionBase & {
  interaction: "map_click";
  answer: string;
  targetGeometryId: string | null;
  targetCoordinates: Coordinates | null;
  flagAsset?: string | null;
};

export type HigherLowerQuestion = QuestionBase & {
  interaction: "higher_lower";
  answer: "higher" | "lower";
  comparisonEntityId: string;
  stat: { key: AtlasStatKey; label: string; firstValue: number; secondValue: number; year?: number; unit: string };
  /** Mixed-subject comparisons (cities, continents, subregions) carry their own display names. */
  first?: { label: string; kind: ComparableKind; detail?: string; note?: string };
  second?: { label: string; kind: ComparableKind; detail?: string; note?: string };
};

export type GuessClue = { kind: CountryHintKind | "numbers"; text: string; flagAsset?: string | null };
export type GuessCountryQuestion = QuestionBase & {
  interaction: "guess_country";
  answer: string;
  /** Four random hints and a fixed fifth reveal; one more is revealed after every unsolved round. */
  clues: GuessClue[];
};

export type ClosestClickQuestion = QuestionBase & {
  interaction: "closest_click";
  answer: Coordinates;
  targetCoordinates: Coordinates;
  targetGeometryId: string | null;
  /** Capital rounds use a 20 km city target around the bundled capital coordinate. */
  targetRadiusKm?: number;
  flagAsset?: string | null;
};

export type AtlasQuestion = ChoiceQuestion | MultiSelectQuestion | MapClickQuestion | HigherLowerQuestion | ClosestClickQuestion | GuessCountryQuestion;
export type AtlasStatKey = "population" | "areaKm2" | "neighborCount" | "officialLanguageCount" | "highestPointM" | "elevationM" | "countryCount";
export type ComparableKind = "country" | "city" | "continent" | "subregion";

export type AtlasCity = { id: string; name: string; countryId: string; population: number; elevationM: number | null; coordinates: Coordinates; capital: boolean };
export type AtlasExtras = { atlasDataVersion: string; synchronizedAt: string; cities: AtlasCity[]; highestPoints: Record<string, { name: string; elevationM: number }> };

/** One dated entry of a country's Independence record. `from` is set when the entry is about independence from a ruler. */
export type HistoryEvent = { year: number; date: string; label: string; from?: string; power?: string; declared?: boolean };
/** `mentions`: every power named in the country's Independence or Background entry, i.e. its recorded ties. */
export type CountryHistory = { record: string; events: HistoryEvent[]; mentions: string[]; formerNames: string[]; background: string };
export type AtlasHistory = { atlasDataVersion: string; synchronizedAt: string; source: { name: string; publisher: string; license: string }; countries: Record<string, CountryHistory> };

export type AtlasDataset = { countries: GeographicEntity[]; extras: AtlasExtras; history: AtlasHistory; version: { atlasDataVersion: string; synchronizedAt: string }; topology: unknown };
