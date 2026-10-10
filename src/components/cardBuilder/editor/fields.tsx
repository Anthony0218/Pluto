import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import type { ReactNode } from "react";
import { RANKS, RANK_NAMES, SUITS, SUIT_NAMES, SUIT_SYMBOLS } from "@/games/cards/cards/card";
import type { ParamKind, ParamSpec } from "@/games/cards/engine/params";
import type { CardRef, ConditionNode, EffectDefinition, PlayerRef, PlayerSetRef, Primitive, ValueRef, ZoneRef } from "@/games/cards/engine/types";
import { inputClass } from "@/components/chessCustom/ui";
import ConditionBuilder from "./ConditionBuilder";
import EffectListEditor from "./EffectListEditor";
import { useCardEditor } from "./editorContext";

/* Compact, generic inputs for every parameter kind used by conditions and effects. */

export const smallInput = `${inputClass} !w-auto min-w-0 py-1 text-xs`;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function Inline({ children }: { children: ReactNode }) {
  useGameLanguage();
  return <span className="inline-flex flex-wrap items-center gap-1.5">{gameUi(children)}</span>;
}

function SelectBox<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  useGameLanguage();
  return (
    <select aria-label={gameUi(label)} value={value} onChange={(event) => onChange(event.target.value as T)} className={`${smallInput} cursor-pointer`}>
      {options.map((option) => (
        <option key={option.id} value={option.id} className="bg-zinc-900">
          {gameUi(option.label)}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ Zones */

export function ZoneIdSelect({ value, onChange, label = "Zone", filter }: { value: string | undefined; onChange: (value: string) => void; label?: string; filter?: "game" | "player" }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const zones = def.zones.filter((zone) => !filter || zone.owner === filter);
  const known = zones.some((zone) => zone.id === value);
  return (
    <SelectBox
      label={gameUi(label)}
      value={value ?? ""}
      onChange={onChange}
      options={[...(known ? [] : [{ id: value ?? "", label: value ? `⚠ ${value} (missing)` : "Choose a zone…" }]), ...zones.map((zone) => ({ id: zone.id, label: `${zone.name}${zone.owner === "player" ? " (each player)" : ""}` }))]}
    />
  );
}

export function ZoneRefEditor({ value, onChange }: { value: ZoneRef | undefined; onChange: (value: ZoneRef) => void }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const ref = value ?? { zone: def.zones[0]?.id ?? "" };
  const owner = def.zones.find((zone) => zone.id === ref.zone)?.owner;
  return (
    <Inline>
      <ZoneIdSelect value={ref.zone} onChange={(zone) => onChange(def.zones.find((entry) => entry.id === zone)?.owner === "player" ? { zone, player: ref.player ?? "self" } : { zone })} />
      {gameUi(owner === "player" && (
        <>
          <span className="text-xs text-zinc-500">{gameUi("of")}</span>
          {gameUi(ref.player === "all" ? (
            <SelectBox label={gameUi("Whose")} value="all" options={[{ id: "all", label: "every player" }, { id: "one", label: "one player…" }]} onChange={(next) => onChange({ ...ref, player: next === "all" ? "all" : "self" })} />
          ) : (
            <>
              <PlayerRefEditor value={ref.player as PlayerRef | undefined} onChange={(player) => onChange({ ...ref, player })} allowAll onAll={() => onChange({ ...ref, player: "all" })} />
            </>
          ))}
        </>
      ))}
    </Inline>
  );
}

/* ---------------------------------------------------------------- Players */

const PLAYER_KINDS = [
  { id: "self", label: "the player (in context)" },
  { id: "actor", label: "the acting player" },
  { id: "eventPlayer", label: "the event's player" },
  { id: "current", label: "the current player" },
  { id: "each", label: "each player (in a loop)" },
  { id: "seat", label: "seat number…" },
  { id: "role", label: "player with role…" },
  { id: "var", label: "player stored in variable…" },
  { id: "next", label: "next player after…" },
  { id: "previous", label: "player before…" },
  { id: "lowestCard", label: "holder of lowest card…" },
  { id: "highestCard", label: "holder of highest card…" },
] as const;
type PlayerKind = (typeof PLAYER_KINDS)[number]["id"];

const playerKind = (ref: PlayerRef | undefined): PlayerKind => {
  if (ref === undefined) return "self";
  if (typeof ref === "string") return ref;
  return (Object.keys(ref).find((key) => PLAYER_KINDS.some((kind) => kind.id === key)) as PlayerKind) ?? "self";
};

function defaultPlayer(kind: PlayerKind, def: ReturnType<typeof useCardEditor>["def"]): PlayerRef {
  switch (kind) {
    case "seat":
      return { seat: 0 };
    case "role":
      return { role: def.roles?.[0] ?? "attacker" };
    case "var":
      return { var: def.variables?.[0]?.key ?? "" };
    case "next":
      return { next: "current" };
    case "previous":
      return { previous: "current" };
    case "lowestCard":
      return { lowestCard: { zone: def.zones.find((zone) => zone.owner === "player")?.id ?? "" }, fallback: { seat: 0 } };
    case "highestCard":
      return { highestCard: { zone: def.zones.find((zone) => zone.owner === "player")?.id ?? "" }, fallback: { seat: 0 } };
    default:
      return kind;
  }
}

export function RoleInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  useGameLanguage();
  const { def } = useCardEditor();
  return (
    <>
      <input aria-label={gameUi("Role")} list="card-builder-roles" className={`${smallInput} w-28`} value={value} onChange={(event) => onChange(event.target.value.replace(/[^A-Za-z0-9_-]/g, ""))} />
      <datalist id="card-builder-roles">
        {(def.roles ?? []).map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>
    </>
  );
}

export function VariableSelect({ value, onChange, player = false }: { value: string; onChange: (value: string) => void; player?: boolean }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const variables = player ? (def.playerVariables ?? []) : [{ key: "trumpSuit", label: "Trump suit" }, ...(def.variables ?? [])];
  const known = variables.some((variable) => variable.key === value);
  return (
    <SelectBox
      label={gameUi(player ? "Player variable" : "Variable")}
      value={value}
      onChange={onChange}
      options={[...(known ? [] : [{ id: value, label: value ? `⚠ ${value} (not declared)` : "Choose a variable…" }]), ...variables.map((variable) => ({ id: variable.key, label: variable.label ? `${variable.label} (${variable.key})` : variable.key }))]}
    />
  );
}

export function PlayerRefEditor({ value, onChange, allowAll, onAll }: { value: PlayerRef | undefined; onChange: (value: PlayerRef) => void; allowAll?: boolean; onAll?: () => void }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const kind = playerKind(value);
  const ref = value as Record<string, unknown>;
  return (
    <Inline>
      <SelectBox
        label={gameUi("Player")}
        value={kind}
        onChange={(next) => (next === ("all" as PlayerKind) ? onAll?.() : onChange(defaultPlayer(next, def)))}
        options={[...PLAYER_KINDS.map((entry) => ({ id: entry.id as PlayerKind, label: entry.label })), ...(allowAll ? [{ id: "all" as PlayerKind, label: "every player" }] : [])]}
      />
      {kind === "seat" && <input aria-label={gameUi("Seat")} type="number" min={1} max={10} className={`${smallInput} w-16`} value={Number(ref.seat) + 1} onChange={(event) => onChange({ seat: Math.max(0, Number(event.target.value) - 1) })} />}
      {kind === "role" && <RoleInput value={String(ref.role ?? "")} onChange={(role) => onChange({ role })} />}
      {kind === "var" && <VariableSelect value={String(ref.var ?? "")} onChange={(variable) => onChange({ var: variable })} />}
      {gameUi(kind === "next" && (
        <>
          <PlayerRefEditor value={ref.next as PlayerRef} onChange={(next) => onChange({ ...(value as object), next } as PlayerRef)} />
          <label className="inline-flex items-center gap-1 text-xs text-zinc-400">
            <input type="checkbox" checked={Boolean(ref.includeSelf)} onChange={(event) => onChange({ ...(value as object), includeSelf: event.target.checked } as PlayerRef)} />{gameUi(" or that player if still in ")}</label>
          <span className="text-xs text-zinc-500">{gameUi("who")}</span>
          <OptionalCondition
            value={ref.where as ConditionNode | undefined}
            emptyLabel="any active player"
            onChange={(where) => {
              const next = { ...(value as Record<string, unknown>) };
              if (where) next.where = where;
              else delete next.where;
              onChange(next as unknown as PlayerRef);
            }}
          />
        </>
      ))}
      {kind === "previous" && <PlayerRefEditor value={ref.previous as PlayerRef} onChange={(previous) => onChange({ previous })} />}
      {gameUi((kind === "lowestCard" || kind === "highestCard") && (
        <>
          <span className="text-xs text-zinc-500">{gameUi("in")}</span>
          <ZoneIdSelect filter="player" value={(ref[kind] as { zone: string }).zone} onChange={(zone) => onChange({ ...(value as object), [kind]: { ...(ref[kind] as object), zone } } as unknown as PlayerRef)} />
          <span className="text-xs text-zinc-500">{gameUi("matching")}</span>
          <OptionalCondition
            value={(ref[kind] as { where?: ConditionNode }).where}
            onChange={(where) => onChange({ ...(value as object), [kind]: { ...(ref[kind] as object), where } } as unknown as PlayerRef)}
            emptyLabel="any card"
          />
        </>
      ))}
    </Inline>
  );
}

export function PlayerSetEditor({ value, onChange }: { value: PlayerSetRef | undefined; onChange: (value: PlayerSetRef) => void }) {
  useGameLanguage();
  const mode = value === "all" || value === "active" || value === undefined ? (value ?? "active") : "custom";
  const custom = isObject(value) ? (value as Exclude<PlayerSetRef, string>) : {};
  const list = (items?: string[]) => (items ?? []).join(", ");
  const parse = (text: string) => text.split(",").map((item) => item.trim()).filter(Boolean);
  return (
    <span className="inline-flex flex-col gap-1.5">
      <Inline>
        <SelectBox
          label={gameUi("Players")}
          value={mode}
          onChange={(next) => onChange(next === "custom" ? { scope: "active" } : next)}
          options={[
            { id: "active", label: "every active player" },
            { id: "all", label: "every player" },
            { id: "custom", label: "players matching…" },
          ]}
        />
      </Inline>
      {gameUi(mode === "custom" && (
        <span className="ml-3 grid gap-1.5 border-l border-white/10 pl-3 text-xs text-zinc-400">
          <Inline>{gameUi(" with roles ")}<input aria-label={gameUi("Roles")} className={`${smallInput} w-36`} placeholder={gameUi("any")} value={list(custom.roles)} onChange={(event) => onChange({ ...custom, roles: parse(event.target.value) })} />{gameUi(" except roles ")}<input aria-label={gameUi("Excluded roles")} className={`${smallInput} w-36`} placeholder={gameUi("none")} value={list(custom.excludeRoles)} onChange={(event) => onChange({ ...custom, excludeRoles: parse(event.target.value) })} />
          </Inline>
          <Inline>{gameUi(" starting with ")}{gameUi(custom.startFrom ? (
              <PlayerRefEditor value={custom.startFrom} onChange={(startFrom) => onChange({ ...custom, startFrom })} />
            ) : (
              <button type="button" className="text-amber-300 underline" onClick={() => onChange({ ...custom, startFrom: "current" })}>{gameUi(" seat order ")}</button>
            ))}{gameUi(" ; last: ")}<input aria-label={gameUi("Roles that go last")} className={`${smallInput} w-28`} placeholder={gameUi("none")} value={list(custom.lastRoles)} onChange={(event) => onChange({ ...custom, lastRoles: parse(event.target.value) })} />
          </Inline>
          <Inline>{gameUi(" where ")}<OptionalCondition value={custom.where} onChange={(where) => onChange({ ...custom, where })} emptyLabel="no extra condition" />
          </Inline>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ Cards */

const CARD_KINDS = [
  { id: "played", label: "the played card" },
  { id: "target", label: "the target card" },
  { id: "each", label: "the card (in a loop/filter)" },
  { id: "top", label: "top card of…" },
  { id: "bottom", label: "bottom card of…" },
  { id: "var", label: "card stored in variable…" },
] as const;

export function CardRefEditor({ value, onChange }: { value: CardRef | undefined; onChange: (value: CardRef) => void }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const kind = typeof value === "string" ? value : isObject(value) ? (Object.keys(value)[0] as "top" | "bottom" | "var") : "played";
  const ref = value as Record<string, unknown>;
  return (
    <Inline>
      <SelectBox
        label={gameUi("Card")}
        value={kind}
        onChange={(next) => onChange(next === "top" || next === "bottom" ? ({ [next]: { zone: def.zones[0]?.id ?? "" } } as CardRef) : next === "var" ? { var: "" } : next)}
        options={CARD_KINDS.map((entry) => ({ id: entry.id, label: entry.label }))}
      />
      {(kind === "top" || kind === "bottom") && <ZoneRefEditor value={ref[kind] as ZoneRef} onChange={(zone) => onChange({ [kind]: zone } as CardRef)} />}
      {kind === "var" && <VariableSelect value={String(ref.var ?? "")} onChange={(variable) => onChange({ var: variable })} />}
    </Inline>
  );
}

/* ----------------------------------------------------------------- Values */

const VALUE_KINDS = [
  { id: "number", label: "number" },
  { id: "text", label: "text" },
  { id: "true", label: "yes (true)" },
  { id: "false", label: "no (false)" },
  { id: "empty", label: "nothing" },
  { id: "setting", label: "lobby setting" },
  { id: "var", label: "game variable" },
  { id: "playerVar", label: "player variable" },
  { id: "score", label: "player's score" },
  { id: "count", label: "cards in zone" },
  { id: "countWhere", label: "matching cards in zone" },
  { id: "handSize", label: "hand size" },
  { id: "cardRank", label: "rank of card" },
  { id: "cardSuit", label: "suit of card" },
  { id: "rankValue", label: "strength of card" },
  { id: "player", label: "a player" },
  { id: "builtin", label: "game info" },
  { id: "playerCount", label: "number of players" },
  { id: "div", label: "division (rounded down)" },
  { id: "add", label: "sum of" },
  { id: "sub", label: "difference" },
  { id: "min", label: "smallest of" },
  { id: "max", label: "largest of" },
] as const;
type ValueKind = (typeof VALUE_KINDS)[number]["id"];

function valueKind(value: ValueRef | undefined): ValueKind {
  if (value === undefined || value === null) return "empty";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return "text";
  if ("const" in value) return valueKind(value.const);
  return (Object.keys(value).find((key) => VALUE_KINDS.some((kind) => kind.id === key)) as ValueKind) ?? "number";
}

function defaultValue(kind: ValueKind, def: ReturnType<typeof useCardEditor>["def"]): ValueRef {
  switch (kind) {
    case "number":
      return 0;
    case "text":
      return "";
    case "true":
      return true;
    case "false":
      return false;
    case "empty":
      return null;
    case "setting":
      return { setting: def.settings?.[0]?.key ?? "" };
    case "var":
      return { var: def.variables?.[0]?.key ?? "trumpSuit" };
    case "playerVar":
      return { playerVar: def.playerVariables?.[0]?.key ?? "", player: "self" };
    case "score":
      return { score: "self" };
    case "count":
      return { count: { zone: def.zones[0]?.id ?? "" } };
    case "countWhere":
      return { countWhere: { zone: def.zones[0]?.id ?? "" }, where: { type: "suitEquals", card: "each", suit: "hearts" } };
    case "handSize":
      return { handSize: "self" };
    case "cardRank":
      return { cardRank: "played" };
    case "cardSuit":
      return { cardSuit: "played" };
    case "rankValue":
      return { rankValue: "played" };
    case "player":
      return { player: "current" };
    case "builtin":
      return { builtin: "round" };
    case "playerCount":
      return { playerCount: "active" };
    case "div":
      return { div: [0, 1] };
    case "add":
      return { add: [0, 0] };
    case "sub":
      return { sub: [0, 0] };
    case "min":
      return { min: [0, 0] };
    case "max":
      return { max: [0, 0] };
  }
}

export function ValueEditor({ value, onChange, depth = 0 }: { value: ValueRef | undefined; onChange: (value: ValueRef) => void; depth?: number }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const kind = valueKind(value);
  const ref = (isObject(value) ? value : {}) as Record<string, unknown>;
  const literal = isObject(value) && "const" in value ? (value.const as Primitive) : (value as Primitive);
  return (
    <Inline>
      <SelectBox label={gameUi("Value type")} value={kind} onChange={(next) => onChange(defaultValue(next, def))} options={VALUE_KINDS.filter((entry) => depth < 2 || !["add", "sub", "min", "max", "div"].includes(entry.id)).map((entry) => ({ id: entry.id, label: entry.label }))} />
      {kind === "number" && <input aria-label={gameUi("Number")} type="number" className={`${smallInput} w-20`} value={Number(literal ?? 0)} onChange={(event) => onChange(Number(event.target.value))} />}
      {gameUi(kind === "text" && (
        <>
          <input aria-label={gameUi("Text")} list="card-builder-literals" className={`${smallInput} w-32`} value={String(literal ?? "")} onChange={(event) => onChange(event.target.value)} />
          <datalist id="card-builder-literals">
            {[...RANKS, ...SUITS].map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </>
      ))}
      {gameUi(kind === "setting" && (
        <SelectBox label={gameUi("Setting")} value={String(ref.setting ?? "")} onChange={(setting) => onChange({ setting })} options={[{ id: "", label: "Choose…" }, ...(def.settings ?? []).map((setting) => ({ id: setting.key, label: setting.label }))]} />
      ))}
      {kind === "var" && <VariableSelect value={String(ref.var ?? "")} onChange={(variable) => onChange({ var: variable })} />}
      {gameUi(kind === "playerVar" && (
        <>
          <VariableSelect player value={String(ref.playerVar ?? "")} onChange={(playerVar) => onChange({ playerVar, player: ref.player as PlayerRef })} />{gameUi(" of ")}<PlayerRefEditor value={ref.player as PlayerRef} onChange={(player) => onChange({ playerVar: String(ref.playerVar ?? ""), player })} />
        </>
      ))}
      {kind === "score" && <PlayerRefEditor value={ref.score as PlayerRef} onChange={(score) => onChange({ score })} />}
      {kind === "handSize" && <PlayerRefEditor value={ref.handSize as PlayerRef} onChange={(handSize) => onChange({ handSize })} />}
      {kind === "player" && <PlayerRefEditor value={ref.player as PlayerRef} onChange={(player) => onChange({ player })} />}
      {kind === "playerCount" && <PlayerSetEditor value={ref.playerCount as PlayerSetRef} onChange={(playerCount) => onChange({ playerCount })} />}
      {kind === "count" && <ZoneRefEditor value={ref.count as ZoneRef} onChange={(count) => onChange({ count })} />}
      {gameUi(kind === "countWhere" && (
        <>
          <ZoneRefEditor value={ref.countWhere as ZoneRef} onChange={(countWhere) => onChange({ countWhere, where: ref.where as ConditionNode })} />
          <span className="text-xs text-zinc-500">{gameUi("where")}</span>
          <ConditionBuilder value={ref.where as ConditionNode} onChange={(where) => onChange({ countWhere: ref.countWhere as ZoneRef, where })} compact />
        </>
      ))}
      {(kind === "cardRank" || kind === "cardSuit" || kind === "rankValue") && <CardRefEditor value={ref[kind] as CardRef} onChange={(card) => onChange({ [kind]: card } as ValueRef)} />}
      {gameUi(kind === "builtin" && (
        <SelectBox
          label={gameUi("Game info")}
          value={String(ref.builtin ?? "round") as "round"}
          onChange={(builtin) => onChange({ builtin })}
          options={[
            { id: "round", label: "round number" },
            { id: "turn" as "round", label: "turn number" },
            { id: "phase" as "round", label: "current phase" },
            { id: "activePlayers" as "round", label: "active players" },
            { id: "trumpSuit" as "round", label: "trump suit" },
          ]}
        />
      ))}
      {gameUi((kind === "add" || kind === "min" || kind === "max" || kind === "sub" || kind === "div") && (
        <span className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/10 px-1.5 py-1">
          {(ref[kind] as ValueRef[]).map((item, index) => (
            <span key={index} className="inline-flex items-center gap-1">
              {index > 0 && <span className="text-xs text-zinc-500">{gameUi(kind === "sub" ? "−" : kind === "div" ? "÷" : kind === "add" ? "+" : ",")}</span>}
              <ValueEditor depth={depth + 1} value={item} onChange={(next) => onChange({ [kind]: (ref[kind] as ValueRef[]).map((entry, i) => (i === index ? next : entry)) } as ValueRef)} />
            </span>
          ))}
          {gameUi(kind !== "sub" && kind !== "div" && (
            <button type="button" className="text-xs text-amber-300" onClick={() => onChange({ [kind]: [...(ref[kind] as ValueRef[]), 0] } as ValueRef)}>{gameUi(" + value ")}</button>
          ))}
        </span>
      ))}
    </Inline>
  );
}

/* ------------------------------------------------------------- Conditions */

export function OptionalCondition({ value, onChange, emptyLabel = "always" }: { value: ConditionNode | undefined; onChange: (value: ConditionNode | undefined) => void; emptyLabel?: string }) {
  useGameLanguage();
  if (!value) {
    return (
      <button type="button" className="rounded-md border border-dashed border-white/15 px-2 py-0.5 text-xs text-zinc-400 hover:border-amber-300/40 hover:text-amber-200" onClick={() => onChange({ type: "and", children: [] })}>
        {gameUi(emptyLabel)}{gameUi(" — add condition ")}</button>
    );
  }
  return (
    <span className="inline-flex items-start gap-1">
      <ConditionBuilder value={value} onChange={onChange} compact />
      <button type="button" aria-label={gameUi("Remove condition")} className="text-xs text-zinc-500 hover:text-red-300" onClick={() => onChange(undefined)}>
        ✕
      </button>
    </span>
  );
}

/* -------------------------------------------------------------- Dispatcher */

const COMPARE_OPTIONS = [
  { id: "eq", label: "equals" },
  { id: "neq", label: "is not" },
  { id: "gt", label: "is more than" },
  { id: "gte", label: "is at least" },
  { id: "lt", label: "is less than" },
  { id: "lte", label: "is at most" },
];

/** One field for one registry parameter. */
export function ParamField({ spec, value, onChange }: { spec: ParamSpec; value: unknown; onChange: (value: unknown) => void }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const kind: ParamKind = spec.kind;
  if (value === undefined && spec.optional && !["condition", "effects"].includes(kind)) {
    return (
      <button type="button" className="rounded-md border border-dashed border-white/15 px-2 py-0.5 text-xs text-zinc-500 hover:text-amber-200" onClick={() => onChange(spec.default ?? (kind === "players" ? "active" : kind === "player" ? "self" : kind === "zone" ? { zone: def.zones[0]?.id ?? "" } : ""))}>
        + {gameUi(spec.label.toLowerCase())}
      </button>
    );
  }
  const clear = spec.optional ? (
    <button type="button" aria-label={gameUi(`Remove ${spec.label}`)} className="text-xs text-zinc-600 hover:text-red-300" onClick={() => onChange(undefined)}>
      ✕
    </button>
  ) : null;
  const wrap = (node: ReactNode) => (
    <Inline>
      {gameUi(node)}
      {gameUi(clear)}
    </Inline>
  );
  switch (kind) {
    case "card":
      return wrap(<CardRefEditor value={value as CardRef} onChange={onChange} />);
    case "player":
      return wrap(<PlayerRefEditor value={value as PlayerRef} onChange={onChange} />);
    case "players":
      return wrap(<PlayerSetEditor value={value as PlayerSetRef} onChange={onChange} />);
    case "zone":
      if (Array.isArray(value)) {
        return (
          <Inline>
            {(value as ZoneRef[]).map((zone, index) => (
              <ZoneRefEditor key={index} value={zone} onChange={(next) => onChange((value as ZoneRef[]).map((entry, i) => (i === index ? next : entry)))} />
            ))}
          </Inline>
        );
      }
      return wrap(<ZoneRefEditor value={value as ZoneRef} onChange={onChange} />);
    case "zoneId":
      return wrap(<ZoneIdSelect value={value as string} onChange={onChange} label={gameUi(spec.label)} />);
    case "zoneIds":
      return (
        <Inline>
          {def.zones.map((zone) => {
            const list = (value as string[]) ?? [];
            return (
              <label key={zone.id} className="inline-flex items-center gap-1 text-xs text-zinc-300">
                <input type="checkbox" checked={list.includes(zone.id)} onChange={(event) => onChange(event.target.checked ? [...list, zone.id] : list.filter((id) => id !== zone.id))} />
                {gameUi(zone.name)}
              </label>
            );
          })}
          {gameUi(clear)}
        </Inline>
      );
    case "value":
      return wrap(<ValueEditor value={value as ValueRef} onChange={onChange} />);
    case "rank":
      return wrap(<SelectBox label={gameUi(spec.label)} value={String(value)} onChange={onChange} options={RANKS.map((rank) => ({ id: rank, label: RANK_NAMES[rank] }))} />);
    case "ranks":
      return (
        <Inline>
          {RANKS.map((rank) => {
            const list = (value as string[]) ?? [];
            const on = list.includes(rank);
            return (
              <button key={rank} type="button" aria-pressed={on} onClick={() => onChange(on ? list.filter((entry) => entry !== rank) : [...list, rank])} className={`rounded-md border px-1.5 py-0.5 text-xs ${on ? "border-amber-300/60 bg-amber-300/20 text-amber-100" : "border-white/10 text-zinc-500"}`}>
                {gameUi(rank)}
              </button>
            );
          })}
        </Inline>
      );
    case "suit":
      return wrap(<SelectBox label={gameUi(spec.label)} value={String(value)} onChange={onChange} options={SUITS.map((suit) => ({ id: suit, label: `${SUIT_SYMBOLS[suit]} ${SUIT_NAMES[suit]}` }))} />);
    case "role":
      return wrap(<RoleInput value={String(value ?? "")} onChange={onChange} />);
    case "phase":
      return wrap(<SelectBox label={gameUi(spec.label)} value={String(value ?? "")} onChange={onChange} options={[...(def.phases.some((phase) => phase.id === value) ? [] : [{ id: String(value ?? ""), label: value ? `⚠ ${String(value)}` : "Choose a phase…" }]), ...def.phases.map((phase) => ({ id: phase.id, label: phase.name }))]} />);
    case "compareOp":
      return <SelectBox label={gameUi(spec.label)} value={String(value ?? "eq")} onChange={onChange} options={COMPARE_OPTIONS} />;
    case "condition":
      return spec.optional ? <OptionalCondition value={value as ConditionNode | undefined} onChange={onChange} /> : <ConditionBuilder value={(value as ConditionNode) ?? { type: "and", children: [] }} onChange={onChange} compact />;
    case "effects":
      return <EffectListEditor value={(value as EffectDefinition[]) ?? []} onChange={onChange} compact />;
    case "boolean":
      return wrap(
        <label className="inline-flex items-center gap-1 text-xs text-zinc-300">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /> {gameUi(spec.label)}
        </label>,
      );
    case "text":
    case "mark":
      return wrap(<input aria-label={gameUi(spec.label)} className={`${smallInput} w-40`} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} />);
    case "variable":
      return wrap(<VariableSelect value={String(value ?? "")} onChange={onChange} />);
    case "playerVariable":
      return wrap(<VariableSelect player value={String(value ?? "")} onChange={onChange} />);
    case "position":
      return wrap(
        <SelectBox
          label={gameUi(spec.label)}
          value={String(value ?? "top")}
          onChange={onChange}
          options={[
            { id: "top", label: "top" },
            { id: "bottom", label: "bottom" },
          ]}
        />,
      );
  }
}
