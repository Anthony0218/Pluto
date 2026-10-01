/**
 * Definition validation, shared by the editor and the server.
 *
 * 1. Structure (`parseGameDefinition`): the JSON may only contain allowlisted
 *    action, condition, effect, event and end-condition types with
 *    well-formed parameters, within size limits. Anything else is rejected —
 *    this is the security boundary for user-made games.
 * 2. Semantics (`validateDefinition`): can this game actually be played?
 *    Missing references, unreachable phases, loops, impossible deals, … are
 *    reported as errors (block publishing) or warnings, plus the checks that
 *    passed.
 */
import { RANKS, SUITS, deckSize, isRank, isSuit } from "../cards/card.ts";
import { getConditionType } from "./conditions.ts";
import { effectEmits, getEffectType } from "./effects.ts";
import type { ParamKind } from "./params.ts";
import { COMPARE_OPS } from "./refs.ts";
import {
  ACTION_TYPES,
  ACTION_TYPE_SHAPE,
  DEFINITION_SCHEMA_VERSION,
  END_CONDITION_TYPES,
  GAME_EVENT_TYPES,
  type ConditionNode,
  type EffectDefinition,
  type GameDefinition,
} from "./types.ts";

export type IssueSeverity = "error" | "warning" | "success";
export type EditorSection = "basics" | "deck" | "players" | "zones" | "setup" | "phases" | "rules" | "events" | "endConditions" | "rulebook" | "settings";

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  section: EditorSection;
  message: string;
  /** JSON-ish path of the offending field ("phases[2].transitions[0].when"). */
  path?: string;
  /** Entity id (phase, rule, action …) for jump-to links in the editor. */
  targetId?: string;
}

export const DEFINITION_LIMITS = {
  jsonBytes: 256_000,
  zones: 30,
  phases: 30,
  actions: 40,
  rules: 200,
  settings: 30,
  variables: 60,
  endConditions: 20,
  effectsPerList: 60,
  conditionDepth: 14,
  valueDepth: 8,
  text: 600,
  rulebookText: 8000,
  players: 10,
  copies: 4,
};

const ID = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/;
const PLAYER_KEYWORDS = ["self", "actor", "eventPlayer", "current", "each"];
const CARD_KEYWORDS = ["played", "target", "each"];
const BUILTINS = ["round", "turn", "phase", "activePlayers", "trumpSuit"];
const BUILTIN_VARIABLES = ["trumpSuit"];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isPrimitive = (value: unknown) => value === null || ["string", "number", "boolean"].includes(typeof value);

/** References collected while walking a definition. */
interface Refs {
  zones: { id: string; path: string; section: EditorSection }[];
  phases: { id: string; path: string; section: EditorSection }[];
  variablesRead: { id: string; path: string; section: EditorSection }[];
  variablesWritten: { id: string; path: string; section: EditorSection }[];
  playerVariables: { id: string; path: string; section: EditorSection }[];
  roles: { id: string; path: string; section: EditorSection }[];
  settings: { id: string; path: string; section: EditorSection }[];
}

class Walker {
  issues: ValidationIssue[] = [];
  refs: Refs = { zones: [], phases: [], variablesRead: [], variablesWritten: [], playerVariables: [], roles: [], settings: [] };
  section: EditorSection = "basics";

  error(path: string, message: string, targetId?: string) {
    this.issues.push({ id: `s${this.issues.length}`, severity: "error", section: this.section, message, path, targetId });
  }

  text(value: unknown, path: string, max = DEFINITION_LIMITS.text, optional = false): boolean {
    if (value === undefined && optional) return true;
    if (typeof value !== "string") return this.error(path, "Expected text."), false;
    if (value.length > max) return this.error(path, `Text is longer than ${max} characters.`), false;
    return true;
  }

  id(value: unknown, path: string): value is string {
    if (typeof value !== "string" || !ID.test(value)) {
      this.error(path, `“${String(value)}” is not a valid id (letters, digits, - and _, starting with a letter).`);
      return false;
    }
    return true;
  }

  int(value: unknown, path: string, min: number, max: number): boolean {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      this.error(path, `Expected a whole number from ${min} to ${max}.`);
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ References */

  player(value: unknown, path: string, depth = 0): void {
    if (depth > 6) return this.error(path, "Player reference is nested too deeply.");
    if (typeof value === "string") {
      if (!PLAYER_KEYWORDS.includes(value)) this.error(path, `Unknown player reference “${value}”.`);
      return;
    }
    if (!isObject(value)) return this.error(path, "Expected a player reference.");
    const keys = Object.keys(value);
    if ("seat" in value && keys.length === 1) return void this.int(value.seat, `${path}.seat`, 0, DEFINITION_LIMITS.players - 1);
    if ("role" in value && keys.length === 1) {
      if (this.id(value.role, `${path}.role`)) this.refs.roles.push({ id: value.role, path, section: this.section });
      return;
    }
    if ("var" in value && keys.length === 1) {
      if (this.id(value.var, `${path}.var`)) this.refs.variablesRead.push({ id: value.var, path, section: this.section });
      return;
    }
    if ("next" in value && keys.every((key) => key === "next" || key === "includeSelf" || key === "where")) {
      if (value.includeSelf !== undefined && typeof value.includeSelf !== "boolean") this.error(`${path}.includeSelf`, "Expected true or false.");
      if (value.where !== undefined) this.condition(value.where, `${path}.where`, depth + 1);
      return this.player(value.next, `${path}.next`, depth + 1);
    }
    if ("previous" in value && keys.every((key) => key === "previous" || key === "where")) {
      if (value.where !== undefined) this.condition(value.where, `${path}.where`, depth + 1);
      return this.player(value.previous, `${path}.previous`, depth + 1);
    }
    for (const key of ["lowestCard", "highestCard"]) {
      if (key in value && keys.every((entry) => entry === key || entry === "fallback")) {
        const spec = value[key];
        if (!isObject(spec) || Object.keys(spec).some((entry) => entry !== "zone" && entry !== "where")) return this.error(`${path}.${key}`, "Expected { zone, where }.");
        this.zoneId(spec.zone, `${path}.${key}.zone`);
        if (spec.where !== undefined) this.condition(spec.where, `${path}.${key}.where`, depth + 1);
        if (value.fallback !== undefined) this.player(value.fallback, `${path}.fallback`, depth + 1);
        return;
      }
    }
    this.error(path, "Unknown player reference.");
  }

  players(value: unknown, path: string): void {
    if (value === "all" || value === "active") return;
    if (!isObject(value)) return this.error(path, "Expected a set of players.");
    for (const key of Object.keys(value)) {
      if (!["scope", "roles", "excludeRoles", "startFrom", "lastRoles", "where"].includes(key)) this.error(`${path}.${key}`, `Unknown option “${key}”.`);
    }
    if (value.scope !== undefined && value.scope !== "all" && value.scope !== "active") this.error(`${path}.scope`, "Expected “all” or “active”.");
    for (const key of ["roles", "excludeRoles", "lastRoles"]) {
      const list = value[key];
      if (list === undefined) continue;
      if (!Array.isArray(list)) {
        this.error(`${path}.${key}`, "Expected a list of roles.");
        continue;
      }
      list.forEach((role, index) => {
        if (this.id(role, `${path}.${key}[${index}]`)) this.refs.roles.push({ id: role, path, section: this.section });
      });
    }
    if (value.startFrom !== undefined) this.player(value.startFrom, `${path}.startFrom`);
    if (value.where !== undefined) this.condition(value.where, `${path}.where`);
  }

  zoneId(value: unknown, path: string) {
    if (this.id(value, path)) this.refs.zones.push({ id: value, path, section: this.section });
  }

  zone(value: unknown, path: string): void {
    if (!isObject(value)) return this.error(path, "Expected a zone.");
    for (const key of Object.keys(value)) if (key !== "zone" && key !== "player") this.error(`${path}.${key}`, `Unknown option “${key}”.`);
    this.zoneId(value.zone, `${path}.zone`);
    if (value.player !== undefined && value.player !== "all") this.player(value.player, `${path}.player`);
  }

  card(value: unknown, path: string): void {
    if (typeof value === "string") {
      if (!CARD_KEYWORDS.includes(value)) this.error(path, `Unknown card reference “${value}”.`);
      return;
    }
    if (!isObject(value) || Object.keys(value).length !== 1) return this.error(path, "Expected a card reference.");
    if ("top" in value) return this.zone(value.top, `${path}.top`);
    if ("bottom" in value) return this.zone(value.bottom, `${path}.bottom`);
    if ("var" in value) {
      if (this.id(value.var, `${path}.var`)) this.refs.variablesRead.push({ id: value.var, path, section: this.section });
      return;
    }
    this.error(path, "Unknown card reference.");
  }

  value(value: unknown, path: string, depth = 0): void {
    if (depth > DEFINITION_LIMITS.valueDepth) return this.error(path, "Value is nested too deeply.");
    if (isPrimitive(value)) {
      if (typeof value === "string" && value.length > DEFINITION_LIMITS.text) this.error(path, "Text value is too long.");
      if (typeof value === "number" && !Number.isFinite(value)) this.error(path, "Numbers must be finite.");
      return;
    }
    if (!isObject(value)) return this.error(path, "Expected a value.");
    const keys = Object.keys(value);
    const only = (...allowed: string[]) => keys.every((key) => allowed.includes(key));
    if ("const" in value && only("const")) return isPrimitive(value.const) ? undefined : this.error(path, "Constants must be text, numbers, true/false or empty.");
    if ("setting" in value && only("setting")) {
      if (this.id(value.setting, `${path}.setting`)) this.refs.settings.push({ id: value.setting, path, section: this.section });
      return;
    }
    if ("var" in value && only("var")) {
      if (this.id(value.var, `${path}.var`)) this.refs.variablesRead.push({ id: value.var, path, section: this.section });
      return;
    }
    if ("playerVar" in value && only("playerVar", "player")) {
      if (this.id(value.playerVar, `${path}.playerVar`)) this.refs.playerVariables.push({ id: value.playerVar, path, section: this.section });
      if (value.player !== undefined) this.player(value.player, `${path}.player`);
      return;
    }
    if ("score" in value && only("score")) return this.player(value.score, `${path}.score`);
    if ("count" in value && only("count")) return this.zone(value.count, `${path}.count`);
    if ("countWhere" in value && only("countWhere", "where")) {
      this.zone(value.countWhere, `${path}.countWhere`);
      return this.condition(value.where, `${path}.where`, depth + 1);
    }
    if ("handSize" in value && only("handSize")) return this.player(value.handSize, `${path}.handSize`);
    for (const key of ["cardRank", "cardSuit", "rankValue"]) if (key in value && only(key)) return this.card(value[key], `${path}.${key}`);
    if ("player" in value && only("player")) return this.player(value.player, `${path}.player`);
    if ("builtin" in value && only("builtin")) return BUILTINS.includes(value.builtin as string) ? undefined : this.error(path, `Unknown built-in value “${String(value.builtin)}”.`);
    for (const key of ["add", "min", "max"]) {
      if (key in value && only(key)) {
        const list = value[key];
        if (!Array.isArray(list) || !list.length || list.length > 10) return this.error(`${path}.${key}`, "Expected 1–10 values.");
        list.forEach((item, index) => this.value(item, `${path}.${key}[${index}]`, depth + 1));
        return;
      }
    }
    if ("playerCount" in value && only("playerCount")) return this.players(value.playerCount, `${path}.playerCount`);
    if ("div" in value && only("div")) {
      if (!Array.isArray(value.div) || value.div.length !== 2) return this.error(`${path}.div`, "Expected two values.");
      value.div.forEach((item, index) => this.value(item, `${path}.div[${index}]`, depth + 1));
      return;
    }
    if ("sub" in value && only("sub")) {
      if (!Array.isArray(value.sub) || value.sub.length !== 2) return this.error(`${path}.sub`, "Expected two values.");
      value.sub.forEach((item, index) => this.value(item, `${path}.sub[${index}]`, depth + 1));
      return;
    }
    this.error(path, `Unknown value type (${keys.join(", ") || "empty"}).`);
  }

  param(kind: ParamKind, value: unknown, path: string, depth: number): void {
    switch (kind) {
      case "card":
        return this.card(value, path);
      case "player":
        return this.player(value, path);
      case "players":
        return this.players(value, path);
      case "zone":
        if (Array.isArray(value)) {
          // awardCards accepts several zones.
          if (value.length > 10) return this.error(path, "Too many zones.");
          value.forEach((zone, index) => this.zone(zone, `${path}[${index}]`));
          return;
        }
        return this.zone(value, path);
      case "zoneId":
        return this.zoneId(value, path);
      case "zoneIds":
        if (!Array.isArray(value) || value.length > 20) return this.error(path, "Expected a list of zones.");
        value.forEach((zone, index) => this.zoneId(zone, `${path}[${index}]`));
        return;
      case "value":
        return this.value(value, path);
      case "rank":
        return isRank(value) ? undefined : this.error(path, `“${String(value)}” is not a rank (${RANKS.join(", ")}).`);
      case "ranks":
        if (!Array.isArray(value) || value.some((rank) => !isRank(rank))) return this.error(path, "Expected a list of ranks.");
        return;
      case "suit":
        return isSuit(value) ? undefined : this.error(path, `“${String(value)}” is not a suit (${SUITS.join(", ")}).`);
      case "role":
        if (this.id(value, path)) this.refs.roles.push({ id: value, path, section: this.section });
        return;
      case "phase":
        if (this.id(value, path)) this.refs.phases.push({ id: value, path, section: this.section });
        return;
      case "compareOp":
        return COMPARE_OPS.includes(value as never) ? undefined : this.error(path, "Unknown comparison.");
      case "condition":
        return this.condition(value, path, depth + 1);
      case "effects":
        return this.effects(value, path, depth + 1);
      case "boolean":
        return typeof value === "boolean" ? undefined : this.error(path, "Expected true or false.");
      case "text":
        return void this.text(value, path);
      case "variable":
        if (this.id(value, path)) this.refs.variablesWritten.push({ id: value, path, section: this.section });
        return;
      case "playerVariable":
        if (this.id(value, path)) this.refs.playerVariables.push({ id: value, path, section: this.section });
        return;
      case "mark":
        return void this.id(value, path);
      case "position":
        return value === "top" || value === "bottom" ? undefined : this.error(path, "Expected “top” or “bottom”.");
    }
  }

  condition(value: unknown, path: string, depth = 0): void {
    if (depth > DEFINITION_LIMITS.conditionDepth) return this.error(path, "Conditions are nested too deeply.");
    if (!isObject(value) || typeof value.type !== "string") return this.error(path, "Expected a condition.");
    if (value.type === "and" || value.type === "or") {
      if (!Array.isArray(value.children) || value.children.length > 30) return this.error(`${path}.children`, "Expected a list of conditions.");
      value.children.forEach((child, index) => this.condition(child, `${path}.children[${index}]`, depth + 1));
      return;
    }
    if (value.type === "not") return this.condition(value.child, `${path}.child`, depth + 1);
    const definition = getConditionType(value.type);
    if (!definition) return this.error(path, `Unknown condition type “${value.type}”.`);
    this.params(definition.params, value, path, depth);
  }

  params(specs: { key: string; kind: ParamKind; optional?: boolean }[], value: Record<string, unknown>, path: string, depth: number) {
    for (const key of Object.keys(value)) {
      if (key !== "type" && !specs.some((spec) => spec.key === key)) this.error(`${path}.${key}`, `Unknown parameter “${key}” for “${String(value.type)}”.`);
    }
    for (const spec of specs) {
      const param = value[spec.key];
      if (param === undefined) {
        if (!spec.optional) this.error(`${path}.${spec.key}`, `“${String(value.type)}” needs “${spec.key}”.`);
        continue;
      }
      // "deal" takes "all" as its count.
      if (spec.kind === "value" && param === "all") continue;
      this.param(spec.kind, param, `${path}.${spec.key}`, depth);
    }
  }

  effects(value: unknown, path: string, depth = 0): void {
    if (depth > DEFINITION_LIMITS.conditionDepth) return this.error(path, "Effects are nested too deeply.");
    if (!Array.isArray(value)) return this.error(path, "Expected a list of effects.");
    if (value.length > DEFINITION_LIMITS.effectsPerList) return this.error(path, `At most ${DEFINITION_LIMITS.effectsPerList} effects per list.`);
    value.forEach((effect, index) => {
      const at = `${path}[${index}]`;
      if (!isObject(effect) || typeof effect.type !== "string") return this.error(at, "Expected an effect.");
      const definition = getEffectType(effect.type);
      if (!definition) return this.error(at, `Unknown effect type “${effect.type}”.`);
      this.params(definition.params, effect, at, depth);
    });
  }

  list(value: unknown, path: string, max: number): unknown[] {
    if (!Array.isArray(value)) {
      this.error(path, "Expected a list.");
      return [];
    }
    if (value.length > max) this.error(path, `At most ${max} entries.`);
    return value.slice(0, max);
  }

  uniqueIds(items: unknown[], path: string) {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const id = isObject(item) ? item.id : undefined;
      if (!this.id(id, `${path}[${index}].id`)) return;
      if (seen.has(id)) this.error(`${path}[${index}].id`, `Duplicate id “${id}”.`, id);
      seen.add(id);
    });
  }
}

/* ---------------------------------------------------------------- Structure */

function walk(raw: unknown): Walker {
  const w = new Walker();
  if (!isObject(raw)) {
    w.error("", "A game definition must be an object.");
    return w;
  }
  try {
    if (JSON.stringify(raw).length > DEFINITION_LIMITS.jsonBytes) w.error("", `The definition is larger than ${DEFINITION_LIMITS.jsonBytes / 1000} kB.`);
  } catch {
    w.error("", "The definition is not plain JSON.");
    return w;
  }
  const def = raw;
  const known = ["schemaVersion", "id", "name", "description", "players", "deck", "zones", "setup", "phases", "actions", "rules", "events", "endConditions", "settings", "variables", "playerVariables", "roles", "rulebook", "templateId", "combinations", "scoreLabel"];
  for (const key of Object.keys(def)) if (!known.includes(key)) w.error(key, `Unknown field “${key}”.`);

  w.section = "basics";
  if (def.schemaVersion !== DEFINITION_SCHEMA_VERSION) w.error("schemaVersion", `Unsupported schema version (expected ${DEFINITION_SCHEMA_VERSION}).`);
  w.id(def.id, "id");
  if (w.text(def.name, "name", 80) && !(def.name as string).trim()) w.error("name", "Give your game a name.");
  w.text(def.description, "description", DEFINITION_LIMITS.text);
  if (def.templateId !== undefined) w.id(def.templateId, "templateId");

  w.section = "players";
  if (!isObject(def.players)) w.error("players", "Expected { min, max }.");
  else if (w.int(def.players.min, "players.min", 1, DEFINITION_LIMITS.players) && w.int(def.players.max, "players.max", 1, DEFINITION_LIMITS.players) && (def.players.min as number) > (def.players.max as number)) {
    w.error("players", "The minimum number of players is larger than the maximum.");
  }
  if (def.roles !== undefined) w.list(def.roles, "roles", 20).forEach((role, index) => w.id(role, `roles[${index}]`));
  if (def.scoreLabel !== undefined) w.text(def.scoreLabel, "scoreLabel", 20);

  w.section = "deck";
  if (!isObject(def.deck)) w.error("deck", "Expected a deck.");
  else {
    const deck = def.deck;
    if (!Array.isArray(deck.ranks) || deck.ranks.some((rank) => !isRank(rank)) || new Set(deck.ranks).size !== deck.ranks.length) w.error("deck.ranks", "Ranks must be distinct values from 6–A.");
    if (!Array.isArray(deck.suits) || deck.suits.some((suit) => !isSuit(suit)) || new Set(deck.suits).size !== deck.suits.length) w.error("deck.suits", "Suits must be distinct.");
    w.int(deck.copies, "deck.copies", 1, DEFINITION_LIMITS.copies);
    if (!Array.isArray(deck.rankOrder) || deck.rankOrder.some((rank) => !isRank(rank)) || new Set(deck.rankOrder).size !== deck.rankOrder.length) {
      w.error("deck.rankOrder", "The rank order must list each rank once.");
    } else if (Array.isArray(deck.ranks) && deck.ranks.some((rank) => !(deck.rankOrder as unknown[]).includes(rank))) {
      w.error("deck.rankOrder", "Every rank in the deck needs a place in the rank order.");
    }
  }

  if (def.combinations !== undefined) {
    const combinations = w.list(def.combinations, "combinations", 20);
    w.uniqueIds(combinations, "combinations");
    combinations.forEach((combination, index) => {
      const path = `combinations[${index}]`;
      if (!isObject(combination)) return w.error(path, "Expected a combination.");
      for (const key of Object.keys(combination)) if (!["id", "name", "groups", "sameSuit", "run", "runSameSuit", "highCanBeLow"].includes(key)) w.error(`${path}.${key}`, `Unknown option “${key}”.`);
      w.text(combination.name, `${path}.name`, 40);
      if (combination.groups !== undefined) {
        if (!Array.isArray(combination.groups) || combination.groups.length > 4) w.error(`${path}.groups`, "Expected up to four group sizes.");
        else combination.groups.forEach((size, groupIndex) => w.int(size, `${path}.groups[${groupIndex}]`, 1, 8));
      }
      if (combination.sameSuit !== undefined) w.int(combination.sameSuit, `${path}.sameSuit`, 1, 12);
      if (combination.run !== undefined) w.int(combination.run, `${path}.run`, 2, 12);
      for (const flag of ["runSameSuit", "highCanBeLow"]) if (combination[flag] !== undefined && typeof combination[flag] !== "boolean") w.error(`${path}.${flag}`, "Expected true or false.");
    });
  }

  w.section = "zones";
  const zones = w.list(def.zones, "zones", DEFINITION_LIMITS.zones);
  w.uniqueIds(zones, "zones");
  zones.forEach((zone, index) => {
    const path = `zones[${index}]`;
    if (!isObject(zone)) return w.error(path, "Expected a zone.");
    w.text(zone.name, `${path}.name`, 60);
    if (zone.owner !== "game" && zone.owner !== "player") w.error(`${path}.owner`, "Owner must be the game or each player.");
    if (!["public", "owner", "hidden"].includes(zone.visibility as string)) w.error(`${path}.visibility`, "Unknown visibility.");
    if (zone.ordering !== "ordered" && zone.ordering !== "unordered") w.error(`${path}.ordering`, "Unknown ordering.");
    if (zone.kind !== undefined && !["drawPile", "hand", "discard", "table", "stack", "captured", "other"].includes(zone.kind as string)) w.error(`${path}.kind`, "Unknown zone kind.");
  });

  w.section = "settings";
  const settings = w.list(def.settings ?? [], "settings", DEFINITION_LIMITS.settings);
  const settingKeys = new Set<string>();
  settings.forEach((setting, index) => {
    const path = `settings[${index}]`;
    if (!isObject(setting)) return w.error(path, "Expected a setting.");
    if (w.id(setting.key, `${path}.key`)) {
      if (settingKeys.has(setting.key)) w.error(`${path}.key`, `Duplicate setting “${setting.key}”.`);
      settingKeys.add(setting.key);
    }
    w.text(setting.label, `${path}.label`, 80);
    w.text(setting.description, `${path}.description`, DEFINITION_LIMITS.text, true);
    switch (setting.type) {
      case "integer":
        if (w.int(setting.min, `${path}.min`, -100000, 100000) && w.int(setting.max, `${path}.max`, -100000, 100000)) w.int(setting.default, `${path}.default`, setting.min as number, setting.max as number);
        break;
      case "boolean":
        if (typeof setting.default !== "boolean") w.error(`${path}.default`, "Expected true or false.");
        break;
      case "select": {
        const options = w.list(setting.options, `${path}.options`, 12);
        options.forEach((option, optionIndex) => {
          if (!isObject(option) || typeof option.value !== "string" || !option.value || option.value.length > 40) w.error(`${path}.options[${optionIndex}]`, "Each option needs a value.");
          else w.text(option.label, `${path}.options[${optionIndex}].label`, 80);
        });
        if (!options.some((option) => isObject(option) && option.value === setting.default)) w.error(`${path}.default`, "The default must be one of the options.");
        break;
      }
      case "string":
        w.text(setting.default, `${path}.default`, 120);
        if (setting.maxLength !== undefined) w.int(setting.maxLength, `${path}.maxLength`, 1, 120);
        break;
      default:
        w.error(`${path}.type`, `Unknown setting type “${String(setting.type)}”.`);
    }
  });

  for (const [key, label] of [
    ["variables", "variables"],
    ["playerVariables", "playerVariables"],
  ] as const) {
    const list = w.list(def[key] ?? [], label, DEFINITION_LIMITS.variables);
    const seen = new Set<string>();
    list.forEach((variable, index) => {
      if (!isObject(variable)) return w.error(`${label}[${index}]`, "Expected a variable.");
      if (w.id(variable.key, `${label}[${index}].key`)) {
        if (seen.has(variable.key)) w.error(`${label}[${index}].key`, `Duplicate variable “${variable.key}”.`);
        seen.add(variable.key);
      }
      if (!isPrimitive(variable.initial)) w.error(`${label}[${index}].initial`, "Initial values must be text, numbers, true/false or empty.");
      w.text(variable.label, `${label}[${index}].label`, 80, true);
      if (variable.visible !== undefined && typeof variable.visible !== "boolean") w.error(`${label}[${index}].visible`, "Expected true or false.");
    });
  }

  w.section = "setup";
  if (!isObject(def.setup)) w.error("setup", "Expected setup.");
  else {
    w.zoneId(def.setup.deckZone, "setup.deckZone");
    if (typeof def.setup.shuffle !== "boolean") w.error("setup.shuffle", "Expected true or false.");
    w.effects(def.setup.steps, "setup.steps");
    if (def.setup.startingPlayer !== undefined) w.player(def.setup.startingPlayer, "setup.startingPlayer");
    if (w.id(def.setup.firstPhase, "setup.firstPhase")) w.refs.phases.push({ id: def.setup.firstPhase, path: "setup.firstPhase", section: "setup" });
  }

  w.section = "phases";
  const phases = w.list(def.phases, "phases", DEFINITION_LIMITS.phases);
  w.uniqueIds(phases, "phases");
  phases.forEach((phase, index) => {
    const path = `phases[${index}]`;
    if (!isObject(phase)) return w.error(path, "Expected a phase.");
    w.text(phase.name, `${path}.name`, 60);
    w.text(phase.description, `${path}.description`, DEFINITION_LIMITS.text, true);
    if (!Array.isArray(phase.allowedActions)) w.error(`${path}.allowedActions`, "Expected a list of actions.");
    else phase.allowedActions.forEach((action, actionIndex) => w.id(action, `${path}.allowedActions[${actionIndex}]`));
    if (phase.activeRoles !== undefined) w.list(phase.activeRoles, `${path}.activeRoles`, 20).forEach((role, roleIndex) => w.param("role", role, `${path}.activeRoles[${roleIndex}]`, 0));
    w.effects(phase.onEnter, `${path}.onEnter`);
    if (phase.onExit !== undefined) w.effects(phase.onExit, `${path}.onExit`);
    w.list(phase.transitions, `${path}.transitions`, 20).forEach((transition, transitionIndex) => {
      const at = `${path}.transitions[${transitionIndex}]`;
      if (!isObject(transition)) return w.error(at, "Expected a transition.");
      if (w.id(transition.to, `${at}.to`)) w.refs.phases.push({ id: transition.to, path: `${at}.to`, section: "phases" });
      if (transition.when !== undefined) w.condition(transition.when, `${at}.when`);
    });
    for (const flag of ["automatic", "autoPass"]) if (phase[flag] !== undefined && typeof phase[flag] !== "boolean") w.error(`${path}.${flag}`, "Expected true or false.");
  });

  const actions = w.list(def.actions, "actions", DEFINITION_LIMITS.actions);
  w.uniqueIds(actions, "actions");
  actions.forEach((action, index) => {
    const path = `actions[${index}]`;
    if (!isObject(action)) return w.error(path, "Expected an action.");
    if (!ACTION_TYPES.includes(action.type as never)) return w.error(`${path}.type`, `Unknown action type “${String(action.type)}”.`, action.id as string);
    w.text(action.label, `${path}.label`, 40);
    w.text(action.description, `${path}.description`, DEFINITION_LIMITS.text, true);
    if (action.actors !== "current" && action.actors !== "all") {
      if (!isObject(action.actors) || !Array.isArray(action.actors.roles)) w.error(`${path}.actors`, "Actors must be the current player, everyone, or a list of roles.");
      else action.actors.roles.forEach((role, roleIndex) => w.param("role", role, `${path}.actors.roles[${roleIndex}]`, 0));
    }
    if (action.condition !== undefined) w.condition(action.condition, `${path}.condition`);
    if (action.cardCondition !== undefined) w.condition(action.cardCondition, `${path}.cardCondition`);
    if (action.source !== undefined) w.zoneId(action.source, `${path}.source`);
    if (action.destination !== undefined) w.zone(action.destination, `${path}.destination`);
    if (action.target !== undefined) {
      if (!isObject(action.target)) w.error(`${path}.target`, "Expected a target.");
      else {
        w.zone(action.target.zone, `${path}.target.zone`);
        if (action.target.where !== undefined) w.condition(action.target.where, `${path}.target.where`);
      }
    }
    w.effects(action.effects, `${path}.effects`);
    if (action.botWeight !== undefined) w.int(action.botWeight, `${path}.botWeight`, 0, 100);
  });

  w.section = "rules";
  const rules = w.list(def.rules, "rules", DEFINITION_LIMITS.rules);
  w.uniqueIds(rules, "rules");
  rules.forEach((rule, index) => {
    const path = `rules[${index}]`;
    if (!isObject(rule)) return w.error(path, "Expected a rule.");
    w.text(rule.name, `${path}.name`, 80);
    w.text(rule.description, `${path}.description`, DEFINITION_LIMITS.text, true);
    if (!GAME_EVENT_TYPES.includes(rule.trigger as never)) w.error(`${path}.trigger`, `Unknown event “${String(rule.trigger)}”.`, rule.id as string);
    if (rule.condition !== undefined) w.condition(rule.condition, `${path}.condition`);
    w.effects(rule.effects, `${path}.effects`);
    if (rule.priority !== undefined) w.int(rule.priority, `${path}.priority`, -1000, 1000);
    for (const flag of ["stopProcessing", "enabled"]) if (rule[flag] !== undefined && typeof rule[flag] !== "boolean") w.error(`${path}.${flag}`, "Expected true or false.");
  });

  w.section = "events";
  w.list(def.events, "events", GAME_EVENT_TYPES.length * 2).forEach((event, index) => {
    if (!isObject(event) || !GAME_EVENT_TYPES.includes(event.type as never)) return w.error(`events[${index}]`, "Unknown event.");
    w.text(event.description, `events[${index}].description`);
  });

  w.section = "endConditions";
  const ends = w.list(def.endConditions, "endConditions", DEFINITION_LIMITS.endConditions);
  w.uniqueIds(ends, "endConditions");
  ends.forEach((end, index) => {
    const path = `endConditions[${index}]`;
    if (!isObject(end)) return w.error(path, "Expected an end condition.");
    if (!END_CONDITION_TYPES.includes(end.type as never)) return w.error(`${path}.type`, `Unknown end condition “${String(end.type)}”.`);
    w.text(end.label, `${path}.label`, 120, true);
    if (end.zones !== undefined) w.param("zoneIds", end.zones, `${path}.zones`, 0);
    if (end.outcome !== undefined && !["win", "finish", "lastWins", "lastLoses"].includes(end.outcome as string)) w.error(`${path}.outcome`, "Unknown outcome.");
    if (end.target !== undefined) w.value(end.target, `${path}.target`);
    if (end.when !== undefined) w.condition(end.when, `${path}.when`);
    if (end.measure !== undefined && end.measure !== "score") {
      if (!isObject(end.measure)) w.error(`${path}.measure`, "Expected “score” or zones.");
      else w.param("zoneIds", end.measure.zones, `${path}.measure.zones`, 0);
    }
    if (end.winners !== undefined) w.players(end.winners, `${path}.winners`);
    if (end.losers !== undefined) w.players(end.losers, `${path}.losers`);
    if (end.draw !== undefined && typeof end.draw !== "boolean") w.error(`${path}.draw`, "Expected true or false.");
    if (end.phases !== undefined) w.list(end.phases, `${path}.phases`, 20).forEach((phase, phaseIndex) => w.param("phase", phase, `${path}.phases[${phaseIndex}]`, 0));
  });

  w.section = "rulebook";
  if (!isObject(def.rulebook)) w.error("rulebook", "Expected a rulebook.");
  else for (const key of ["overview", "setup", "gameplay", "winning"]) w.text(def.rulebook[key], `rulebook.${key}`, DEFINITION_LIMITS.rulebookText);
  if (isObject(def.rulebook) && def.rulebook.notes !== undefined) w.text(def.rulebook.notes, "rulebook.notes", DEFINITION_LIMITS.rulebookText);
  return w;
}

/**
 * Server-side entry point: returns the definition only when its structure is
 * entirely allowlisted. Semantic problems are returned as issues alongside.
 */
export function parseGameDefinition(raw: unknown): { definition: GameDefinition | null; issues: ValidationIssue[] } {
  let value = raw;
  if (typeof raw === "string") {
    if (raw.length > DEFINITION_LIMITS.jsonBytes) return { definition: null, issues: [{ id: "size", severity: "error", section: "basics", message: "The definition is too large." }] };
    try {
      value = JSON.parse(raw);
    } catch {
      return { definition: null, issues: [{ id: "json", severity: "error", section: "basics", message: "Not valid JSON." }] };
    }
  }
  const structure = walk(value).issues;
  if (structure.length) return { definition: null, issues: structure };
  // A structural deep copy: drops prototypes and anything not representable in JSON.
  const definition = JSON.parse(JSON.stringify(value)) as GameDefinition;
  return { definition, issues: validateDefinition(definition).issues };
}

/* ---------------------------------------------------------------- Semantics */

export interface ValidationReport {
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  successes: ValidationIssue[];
  canPublish: boolean;
}

function forEachEffect(effects: EffectDefinition[] | undefined, visit: (effect: EffectDefinition) => void) {
  for (const effect of effects ?? []) {
    visit(effect);
    for (const nested of [effect.then, effect.else, effect.effects]) if (Array.isArray(nested)) forEachEffect(nested as EffectDefinition[], visit);
  }
}

function allEffectLists(def: GameDefinition): EffectDefinition[][] {
  return [def.setup.steps, ...def.phases.flatMap((phase) => [phase.onEnter, phase.onExit ?? []]), ...def.actions.map((action) => action.effects), ...def.rules.map((rule) => rule.effects)];
}

function setupDealCount(def: GameDefinition, settingsAt: "default" | "max"): number {
  let total = 0;
  forEachEffect(def.setup.steps, (effect) => {
    if (effect.type !== "deal" || effect.count === "all") return;
    let count = 0;
    const raw = effect.count as unknown;
    if (typeof raw === "number") count = raw;
    else if (isObject(raw) && typeof raw.setting === "string") {
      const setting = def.settings?.find((entry) => entry.key === raw.setting);
      if (setting?.type === "integer") count = settingsAt === "max" ? setting.max : setting.default;
    }
    total += count;
  });
  return total;
}

export function validateDefinition(def: GameDefinition): ValidationReport {
  const structural = walk(def);
  const issues: ValidationIssue[] = [...structural.issues];
  const add = (severity: IssueSeverity, section: EditorSection, message: string, extra: { path?: string; targetId?: string } = {}) =>
    issues.push({ id: `${section}-${issues.length}`, severity, section, message, ...extra });
  if (structural.issues.length) {
    // Semantic checks assume a well-formed shape.
    return report(issues);
  }
  const refs = structural.refs;
  const zoneIds = new Set(def.zones.map((zone) => zone.id));
  const phaseIds = new Set(def.phases.map((phase) => phase.id));
  const actionIds = new Set(def.actions.map((action) => action.id));
  const variables = new Set([...BUILTIN_VARIABLES, ...(def.variables ?? []).map((variable) => variable.key)]);
  const playerVariables = new Set((def.playerVariables ?? []).map((variable) => variable.key));
  const settingKeys = new Set((def.settings ?? []).map((setting) => setting.key));
  const passed = (section: EditorSection, message: string) => add("success", section, message);

  /* References */
  const missing = (list: { id: string; path: string; section: EditorSection }[], known: Set<string>, what: string) => {
    let ok = true;
    for (const ref of list) {
      if (!known.has(ref.id)) {
        ok = false;
        add("error", ref.section, `Referenced ${what} “${ref.id}” does not exist.`, { path: ref.path, targetId: ref.id });
      }
    }
    return ok;
  };
  if (missing(refs.zones, zoneIds, "zone")) passed("zones", "Every zone reference points to an existing zone.");
  if (missing(refs.phases, phaseIds, "phase")) passed("phases", "Every phase reference points to an existing phase.");
  const varsOk = missing(refs.variablesRead, variables, "variable") && missing(refs.variablesWritten, variables, "variable") && missing(refs.playerVariables, playerVariables, "player variable");
  if (varsOk) passed("rules", "Every variable used is declared.");
  if (missing(refs.settings, settingKeys, "setting")) passed("settings", "Every setting used exists.");
  if (def.roles?.length) {
    const roles = new Set(def.roles);
    for (const ref of refs.roles) if (!roles.has(ref.id)) add("warning", ref.section, `Role “${ref.id}” is not in the game's role list.`, { path: ref.path });
  }

  /* Deck */
  const size = deckSize(def.deck);
  if (size === 0) add("error", "deck", "The game would start with zero cards — include at least one rank and one suit.");
  else passed("deck", `The deck has ${size} cards.`);
  if (!zoneIds.has(def.setup.deckZone)) add("error", "setup", `The deck zone “${def.setup.deckZone}” does not exist.`);
  else if (def.zones.find((zone) => zone.id === def.setup.deckZone)?.owner !== "game") add("error", "setup", "The deck must start in a game zone, not a player zone.");
  const dealt = setupDealCount(def, "default") * def.players.max;
  const dealtMax = setupDealCount(def, "max") * def.players.max;
  if (dealt > size) add("error", "setup", `Card count cannot satisfy the initial deal: ${def.players.max} players need ${dealt} cards but the deck has ${size}.`);
  else if (dealtMax > size) add("warning", "setup", `With the largest hand size setting, ${def.players.max} players would need ${dealtMax} cards (deck: ${size}). Deals stop when the deck runs out.`);
  else passed("setup", "The initial deal fits the deck.");

  /* Starting player */
  let choosesPlayer = Boolean(def.setup.startingPlayer);
  forEachEffect(def.setup.steps, (effect) => {
    if (effect.type === "setCurrentPlayer" || effect.type === "assignRole") choosesPlayer = true;
  });
  if (!choosesPlayer) add("error", "setup", "No starting player can be determined — choose one in Setup.");
  else passed("setup", "A starting player is determined.");

  /* Phases */
  if (!phaseIds.has(def.setup.firstPhase)) add("error", "setup", "Choose the phase the game starts in.");
  const phaseExits = new Map<string, boolean>();
  for (const phase of def.phases) {
    for (const actionId of phase.allowedActions) {
      if (!actionIds.has(actionId)) add("error", "phases", `Phase “${phase.name}” allows an unknown action “${actionId}”.`, { targetId: phase.id });
    }
    if (!phase.automatic && !phase.allowedActions.some((id) => actionIds.has(id))) {
      add("error", "phases", `Players have no available actions in the “${phase.name}” phase.`, { targetId: phase.id });
    }
    if (phase.automatic && phase.allowedActions.length) add("warning", "phases", `“${phase.name}” is automatic, so its actions are never offered.`, { targetId: phase.id });
    // Exits: transitions, or a startPhase/endPhase reachable from this phase's actions/entry or any rule.
    let exit = phase.transitions.length > 0;
    const scan = (effects: EffectDefinition[] | undefined) =>
      forEachEffect(effects, (effect) => {
        if (effect.type === "startPhase" || effect.type === "endPhase" || effect.type === "endGame") exit = true;
      });
    scan(phase.onEnter);
    for (const actionId of phase.allowedActions) scan(def.actions.find((action) => action.id === actionId)?.effects);
    phaseExits.set(phase.id, exit);
    if (phase.automatic && !phase.transitions.some((transition) => !transition.when) && !exit) {
      add("error", "phases", `Automatic phase “${phase.name}” has no possible exit.`, { targetId: phase.id });
    } else if (phase.automatic && !phase.transitions.some((transition) => !transition.when)) {
      add("warning", "phases", `Automatic phase “${phase.name}” has no fallback transition; if no condition matches, the game stops.`, { targetId: phase.id });
    } else if (!exit && def.phases.length > 1) {
      add("warning", "phases", `Phase “${phase.name}” has no exit — once reached, the game stays there until an end condition is met.`, { targetId: phase.id });
    }
  }
  const unreachable = reachablePhases(def);
  for (const phase of def.phases) if (!unreachable.has(phase.id)) add("warning", "phases", `Phase “${phase.name}” can never be reached.`, { targetId: phase.id });
  if (![...phaseExits.values()].some((exit) => !exit) || def.phases.length === 1) passed("phases", "Every phase has a way out (or the game is a single repeating phase).");

  const loop = automaticLoop(def);
  if (loop?.unconditional) add("error", "phases", `Infinite automatic transition detected: ${loop.cycle.map((id) => def.phases.find((phase) => phase.id === id)?.name ?? id).join(" → ")} → … with no player input.`);
  else if (loop) add("warning", "phases", `Automatic phases can loop (${loop.cycle.join(" → ")}); make sure a condition eventually stops it.`);
  else passed("phases", "No automatic phase loop.");

  /* Actions */
  for (const action of def.actions) {
    const shape = ACTION_TYPE_SHAPE[action.type];
    if (shape !== "none" && !action.source) add("error", "phases", `Action “${action.label}” plays a card but has no source zone.`, { targetId: action.id });
    if (shape !== "none" && !action.destination) add("warning", "phases", `Action “${action.label}” has no destination — the card stays where it is unless an effect moves it.`, { targetId: action.id });
    if (shape === "cardAndTarget" && !action.target) add("error", "phases", `Action “${action.label}” needs a target zone.`, { targetId: action.id });
    if (!def.phases.some((phase) => phase.allowedActions.includes(action.id))) add("warning", "phases", `Action “${action.label}” is not allowed in any phase.`, { targetId: action.id });
  }

  /* Combinations */
  let ranksHands = false;
  for (const list of allEffectLists(def)) forEachEffect(list, (effect) => {
    if (effect.type === "rankHands") ranksHands = true;
  });
  if (ranksHands && !def.combinations?.length) add("error", "deck", "“Find the best hand” is used, but the game defines no card combinations.");
  else if (ranksHands) passed("deck", `${def.combinations!.length} card combinations rank the hands.`);

  /* Rules */
  let recursive = false;
  for (const rule of def.rules) {
    const emits = effectEmits(rule.effects);
    if (emits.has(rule.trigger)) {
      recursive = true;
      if (!rule.condition) add("error", "rules", `Rule “${rule.name}” can recursively trigger itself indefinitely (it reacts to and causes “${rule.trigger}”). Add a condition.`, { targetId: rule.id });
      else add("warning", "rules", `Rule “${rule.name}” may trigger itself; the engine stops after a fixed depth.`, { targetId: rule.id });
    }
  }
  if (!recursive) passed("rules", "No rule triggers itself.");
  const pairs = mutualRuleCycle(def);
  if (pairs) add("warning", "rules", `Rules “${pairs[0]}” and “${pairs[1]}” can trigger each other.`);

  /* End conditions */
  let canEnd = def.endConditions.some((end) => end.type !== "PLAYER_HAND_EMPTY" || end.outcome !== "finish");
  for (const list of allEffectLists(def)) forEachEffect(list, (effect) => {
    if (effect.type === "endGame") canEnd = true;
  });
  if (!canEnd) add("error", "endConditions", "No win condition exists — the game can never end.");
  else passed("endConditions", "The game has a way to end.");
  const finishesOnly = def.endConditions.some((end) => end.type === "PLAYER_HAND_EMPTY" && end.outcome === "finish");
  if (finishesOnly && !def.endConditions.some((end) => end.type === "LAST_ACTIVE_PLAYER")) {
    add("warning", "endConditions", "Players can finish, but nothing ends the game when only one is left — add “Only one player is left”.");
  }

  /* Settings */
  for (const setting of def.settings ?? []) {
    if (!refs.settings.some((ref) => ref.id === setting.key)) add("warning", "settings", `Setting “${setting.label}” is never used by a rule or effect.`, { targetId: setting.key });
  }

  /* Rulebook */
  const empty = (["overview", "setup", "gameplay", "winning"] as const).filter((key) => !def.rulebook[key]?.trim());
  if (empty.length) add("warning", "rulebook", `The rulebook is missing: ${empty.join(", ")}.`);
  else passed("rulebook", "The rulebook covers overview, setup, gameplay and winning.");

  /* Events documentation */
  for (const event of def.events) if (!GAME_EVENT_TYPES.includes(event.type)) add("error", "events", `Unknown event “${event.type}”.`);

  return report(issues);
}

function report(issues: ValidationIssue[]): ValidationReport {
  const errors = issues.filter((issue) => issue.severity === "error");
  return {
    issues,
    errors,
    warnings: issues.filter((issue) => issue.severity === "warning"),
    successes: issues.filter((issue) => issue.severity === "success"),
    canPublish: errors.length === 0,
  };
}

function phaseTargets(def: GameDefinition, phaseId: string): string[] {
  const phase = def.phases.find((entry) => entry.id === phaseId);
  if (!phase) return [];
  const out = new Set(phase.transitions.map((transition) => transition.to));
  const scan = (effects: EffectDefinition[] | undefined) =>
    forEachEffect(effects, (effect) => {
      if ((effect.type === "startPhase" && typeof effect.phase === "string")) out.add(effect.phase);
      if (effect.type === "endPhase") {
        if (typeof effect.to === "string") out.add(effect.to);
        else {
          const index = def.phases.findIndex((entry) => entry.id === phaseId);
          out.add(def.phases[(index + 1) % def.phases.length].id);
        }
      }
    });
  scan(phase.onEnter);
  for (const actionId of phase.allowedActions) scan(def.actions.find((action) => action.id === actionId)?.effects);
  return [...out];
}

function reachablePhases(def: GameDefinition): Set<string> {
  const seen = new Set<string>();
  const queue = [def.setup.firstPhase];
  // Rules can jump anywhere.
  for (const rule of def.rules) forEachEffect(rule.effects, (effect) => {
    if (effect.type === "startPhase" && typeof effect.phase === "string") queue.push(effect.phase);
  });
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...phaseTargets(def, id));
  }
  return seen;
}

/** A cycle that stays inside automatic phases (no player can interrupt it). */
function automaticLoop(def: GameDefinition): { cycle: string[]; unconditional: boolean } | undefined {
  const automatic = new Set(def.phases.filter((phase) => phase.automatic).map((phase) => phase.id));
  const edges = (id: string) => {
    const phase = def.phases.find((entry) => entry.id === id)!;
    return phase.transitions.filter((transition) => automatic.has(transition.to)).map((transition) => ({ to: transition.to, unconditional: !transition.when && phase.transitions.indexOf(transition) === 0 }));
  };
  for (const start of automatic) {
    const stack: { id: string; path: string[]; unconditional: boolean }[] = [{ id: start, path: [start], unconditional: true }];
    while (stack.length) {
      const { id, path, unconditional } = stack.pop()!;
      for (const edge of edges(id)) {
        if (edge.to === start) return { cycle: path, unconditional: unconditional && edge.unconditional };
        if (!path.includes(edge.to)) stack.push({ id: edge.to, path: [...path, edge.to], unconditional: unconditional && edge.unconditional });
      }
    }
  }
  return undefined;
}

function mutualRuleCycle(def: GameDefinition): [string, string] | undefined {
  for (const a of def.rules) {
    const aEmits = effectEmits(a.effects);
    for (const b of def.rules) {
      if (a === b) continue;
      if (aEmits.has(b.trigger) && effectEmits(b.effects).has(a.trigger) && !a.condition && !b.condition) return [a.name, b.name];
    }
  }
  return undefined;
}

/** Conditions used in a definition (for the editor's summary counters). */
export function countConditions(node: ConditionNode | undefined): number {
  if (!node) return 0;
  if (node.type === "and" || node.type === "or") return (node.children as ConditionNode[]).reduce((sum, child) => sum + countConditions(child), 0);
  if (node.type === "not") return countConditions(node.child as ConditionNode);
  return 1;
}

