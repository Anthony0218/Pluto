export type AtlasDifficulty = "beginner" | "intermediate" | "expert";
export type AtlasScope = "un195" | "territories" | "all_map_entities";
export type AtlasCategory = "countries" | "locations" | "capitals" | "flags" | "population" | "area" | "continents" | "languages" | "borders" | "currency";
export type AtlasInteraction = "single_choice" | "multi_select" | "map_click" | "closest_click" | "higher_lower" | "map_fill";
export type AtlasMode = "map_click" | "speed_run" | "map_fill";

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
};

export type ClosestClickQuestion = QuestionBase & {
  interaction: "closest_click";
  answer: Coordinates;
  targetCoordinates: Coordinates;
  targetGeometryId: string | null;
};

export type AtlasQuestion = ChoiceQuestion | MultiSelectQuestion | MapClickQuestion | HigherLowerQuestion | ClosestClickQuestion;
export type AtlasStatKey = "population" | "areaKm2" | "neighborCount" | "officialLanguageCount";

export type AtlasDataset = { countries: GeographicEntity[]; version: { atlasDataVersion: string; synchronizedAt: string }; topology: unknown };
