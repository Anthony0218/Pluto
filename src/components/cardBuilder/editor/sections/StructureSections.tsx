import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { describeEffects } from "@/games/cards/engine/effects";
import { describeAction, describePhase, describeZoneDefinition } from "@/games/cards/engine/rulebook";
import { ACTION_TYPES, ACTION_TYPE_SHAPE, type ActionDefinition, type ActorSpec, type EffectDefinition, type PhaseDefinition, type ZoneDefinition } from "@/games/cards/engine/types";
import { Button, Chip, Field, NumberField, Panel, Toggle, inputClass } from "@/components/chessCustom/ui";
import EffectListEditor from "../EffectListEditor";
import { useCardEditor, useIssuesFor } from "../editorContext";
import { OptionalCondition, PlayerRefEditor, RoleInput, ZoneIdSelect, ZoneRefEditor } from "../fields";
import SectionShell, { IssueList } from "../SectionShell";

const ident = (text: string) => text.replace(/[^A-Za-z0-9_-]/g, "").replace(/^[^A-Za-z]+/, "");
const uniqueId = (base: string, taken: string[]) => {
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}${n}`;
  return id;
};

/* 4. Zones */
export function ZonesSection() {
  useGameLanguage();
  const { def, edit, mode } = useCardEditor();
  const update = (index: number, patch: Partial<ZoneDefinition>) => edit((draft) => void (draft.zones[index] = { ...draft.zones[index], ...patch }));
  return (
    <SectionShell
      section="zones"
      eyebrow="4 · Zones"
      title={gameUi("Zones")}
      description={gameUi("Places where cards can be: a draw pile, each player's hand, the table, captured cards… Shared zones exist once; player zones exist once per player.")}
      actions={
        <Button size="sm" onClick={() => edit((draft) => void draft.zones.push({ id: uniqueId("zone", draft.zones.map((zone) => zone.id)), name: "New zone", owner: "game", visibility: "public", ordering: "ordered", kind: "other" }))}>
          <Plus size={14} /> Add zone
        </Button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {def.zones.map((zone, index) => (
          <Panel
            key={index}
            title={gameUi(zone.name)}
            eyebrow={describeZoneDefinition(zone)}
            actions={
              <button type="button" aria-label={`Delete zone ${zone.name}`} className="text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void draft.zones.splice(index, 1))}>
                <Trash2 size={14} />
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={gameUi("Name")}>
                <input className={inputClass} value={zone.name} onChange={(event) => update(index, { name: event.target.value })} />
              </Field>
              {gameUi(mode === "advanced" && (
                <Field label={gameUi("Id (used by rules)")}>
                  <input className={`${inputClass} font-mono`} value={zone.id} onChange={(event) => update(index, { id: ident(event.target.value) })} />
                </Field>
              ))}
              <Field label={gameUi("Belongs to")}>
                <select className={inputClass} value={zone.owner} onChange={(event) => update(index, { owner: event.target.value as ZoneDefinition["owner"] })}>
                  <option value="game">{gameUi("The table (shared)")}</option>
                  <option value="player">{gameUi("Each player")}</option>
                </select>
              </Field>
              <Field label={gameUi("Who sees the cards")}>
                <select className={inputClass} value={zone.visibility} onChange={(event) => update(index, { visibility: event.target.value as ZoneDefinition["visibility"] })}>
                  <option value="public">{gameUi("Everyone (face up)")}</option>
                  <option value="owner">{gameUi("Only the owner")}</option>
                  <option value="hidden">{gameUi("Nobody (face down)")}</option>
                </select>
              </Field>
              <Field label={gameUi("Order")}>
                <select className={inputClass} value={zone.ordering} onChange={(event) => update(index, { ordering: event.target.value as ZoneDefinition["ordering"] })}>
                  <option value="ordered">{gameUi("Ordered (a stack or row)")}</option>
                  <option value="unordered">{gameUi("Unordered (a hand or heap)")}</option>
                </select>
              </Field>
              <Field label={gameUi("Kind")} hint="Draw piles and hands also emit DRAW_PILE_EMPTY / HAND_EMPTY.">
                <select className={inputClass} value={zone.kind ?? "other"} onChange={(event) => update(index, { kind: event.target.value as ZoneDefinition["kind"] })}>
                  {["drawPile", "hand", "discard", "table", "stack", "captured", "other"].map((kind) => (
                    <option key={kind} value={kind}>
                      {gameUi(kind)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>
        ))}
      </div>
    </SectionShell>
  );
}

/* 5. Setup */
export function SetupSection() {
  useGameLanguage();
  const { def, edit, mode } = useCardEditor();
  const deal = def.setup.steps.findIndex((step) => step.type === "deal");
  const dealStep = deal >= 0 ? def.setup.steps[deal] : undefined;
  return (
    <SectionShell section="setup" eyebrow="5 · Setup" title={gameUi("Setup")} description={gameUi("What happens before the first move: where the deck starts, whether it is shuffled, how cards are dealt and who starts.")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={gameUi("Deck & deal")}>
          <div className="space-y-3">
            <Field label={gameUi("The deck starts in")}>
              <ZoneIdSelect filter="game" value={def.setup.deckZone} onChange={(deckZone) => edit((draft) => void (draft.setup.deckZone = deckZone))} />
            </Field>
            <Toggle checked={def.setup.shuffle} onChange={(shuffle) => edit((draft) => void (draft.setup.shuffle = shuffle))} label={gameUi("Shuffle the deck first")} />
            {gameUi(dealStep && (
              <Field label={gameUi("Cards dealt to each player")} hint={typeof dealStep.count === "object" ? "Uses a lobby setting — change its default in Game settings." : undefined}>
                {gameUi(dealStep.count === "all" ? (
                  <span className="text-sm text-zinc-300">{gameUi(" All cards, evenly")}{gameUi(" ")}
                    <button type="button" className="text-amber-300 underline" onClick={() => edit((draft) => void (draft.setup.steps[deal].count = 5))}>{gameUi(" use a fixed number ")}</button>
                  </span>
                ) : typeof dealStep.count === "number" ? (
                  <span className="flex items-center gap-3">
                    <NumberField value={dealStep.count} min={0} max={32} label={gameUi("Cards per player")} onChange={(count) => edit((draft) => void (draft.setup.steps[deal].count = count))} />
                    <button type="button" className="text-xs text-amber-300 underline" onClick={() => edit((draft) => void (draft.setup.steps[deal].count = "all"))}>{gameUi(" deal everything ")}</button>
                  </span>
                ) : (
                  <span className="text-sm text-zinc-300">{gameUi(describeEffects([dealStep], { def }))}</span>
                ))}
              </Field>
            ))}
          </div>
        </Panel>
        <Panel title={gameUi("Start")}>
          <div className="space-y-3">
            <Field label={gameUi("Starting player")} hint="Used when no setup step picks one.">
              {gameUi(def.setup.startingPlayer ? (
                <span className="flex items-center gap-2">
                  <PlayerRefEditor value={def.setup.startingPlayer} onChange={(startingPlayer) => edit((draft) => void (draft.setup.startingPlayer = startingPlayer))} />
                  <button type="button" aria-label={gameUi("Remove starting player")} className="text-xs text-zinc-500" onClick={() => edit((draft) => void delete draft.setup.startingPlayer)}>
                    ✕
                  </button>
                </span>
              ) : (
                <Button size="sm" onClick={() => edit((draft) => void (draft.setup.startingPlayer = { seat: 0 }))}>{gameUi(" Choose starting player ")}</Button>
              ))}
            </Field>
            <Field label={gameUi("First phase")}>
              <select className={inputClass} value={def.setup.firstPhase} onChange={(event) => edit((draft) => void (draft.setup.firstPhase = event.target.value))}>
                {!def.phases.some((phase) => phase.id === def.setup.firstPhase) && <option value={def.setup.firstPhase}>⚠ {gameUi(def.setup.firstPhase || "choose")}</option>}
                {def.phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Panel>
      </div>
      <Panel title={gameUi("Setup steps")} eyebrow={mode === "basic" ? "Switch to Advanced to edit" : "Run once, in order"}>
        {gameUi(mode === "advanced" ? (
          <EffectListEditor value={def.setup.steps} onChange={(steps) => edit((draft) => void (draft.setup.steps = steps))} />
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-300">
            {def.setup.steps.map((step, index) => (
              <li key={index}>{gameUi(describeEffects([step], { def }))}</li>
            ))}
          </ol>
        ))}
      </Panel>
    </SectionShell>
  );
}

/* 6. Turn phases (+ actions) */
function EffectsField({ label, value, onChange }: { label: string; value: EffectDefinition[] | undefined; onChange: (value: EffectDefinition[]) => void }) {
  useGameLanguage();
  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{gameUi(label)}</p>
      <EffectListEditor value={value ?? []} onChange={onChange} />
    </div>
  );
}

function PhaseCard({ phase, index }: { phase: PhaseDefinition; index: number }) {
  useGameLanguage();
  const { def, edit, mode } = useCardEditor();
  const issues = useIssuesFor(phase.id);
  const [open, setOpen] = useState(false);
  const update = (mutate: (draft: PhaseDefinition) => void) => edit((draft) => mutate(draft.phases[index]));
  const move = (delta: number) =>
    edit((draft) => {
      const [item] = draft.phases.splice(index, 1);
      draft.phases.splice(index + delta, 0, item);
    });
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">{gameUi(index + 1)}</span> {phase.name}
          {phase.automatic && <Chip tone="violet">{gameUi("automatic")}</Chip>}
          {phase.autoPass && <Chip>{gameUi("auto-pass")}</Chip>}
          {def.setup.firstPhase === phase.id && <Chip tone="amber">{gameUi("first")}</Chip>}
        </span>
      }
      actions={
        <>
          <button type="button" aria-label="Move phase earlier" disabled={index === 0} className="p-1 text-zinc-500 disabled:opacity-30" onClick={() => move(-1)}>
            <ArrowUp size={14} />
          </button>
          <button type="button" aria-label="Move phase later" disabled={index === def.phases.length - 1} className="p-1 text-zinc-500 disabled:opacity-30" onClick={() => move(1)}>
            <ArrowDown size={14} />
          </button>
          <Button size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Close" : "Edit"}
          </Button>
          <button type="button" aria-label={`Delete phase ${phase.name}`} className="p-1 text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void draft.phases.splice(index, 1))}>
            <Trash2 size={14} />
          </button>
        </>
      }
    >
      <p className="text-sm text-zinc-400">{gameUi(describePhase(phase, { def }))}</p>
      <div className="mt-2">
        <IssueList issues={issues} />
      </div>
      {gameUi(open && (
        <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={gameUi("Name")}>
              <input className={inputClass} value={phase.name} onChange={(event) => update((draft) => void (draft.name = event.target.value))} />
            </Field>
            {gameUi(mode === "advanced" && (
              <Field label={gameUi("Id")}>
                <input className={`${inputClass} font-mono`} value={phase.id} onChange={(event) => update((draft) => void (draft.id = ident(event.target.value)))} />
              </Field>
            ))}
            <Field label={gameUi("Description")}>
              <input className={inputClass} value={phase.description ?? ""} onChange={(event) => update((draft) => void (draft.description = event.target.value))} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle checked={Boolean(phase.automatic)} onChange={(automatic) => update((draft) => void (draft.automatic = automatic))} label={gameUi("Automatic")} description={gameUi("No player input — entry effects run and the game moves on.")} />
            <Toggle checked={Boolean(phase.autoPass)} onChange={(autoPass) => update((draft) => void (draft.autoPass = autoPass))} label={gameUi("Auto-pass")} description={gameUi("Players whose only option is “pass” pass automatically.")} />
          </div>
          {gameUi(!phase.automatic && (
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{gameUi("Allowed actions")}</p>
              <div className="flex flex-wrap gap-2">
                {def.actions.map((action) => {
                  const on = phase.allowedActions.includes(action.id);
                  return (
                    <label key={action.id} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${on ? "border-amber-300/50 bg-amber-300/10 text-amber-100" : "border-white/10 text-zinc-400"}`}>
                      <input type="checkbox" checked={on} onChange={(event) => update((draft) => void (draft.allowedActions = event.target.checked ? [...draft.allowedActions, action.id] : draft.allowedActions.filter((id) => id !== action.id)))} />
                      {gameUi(action.label)}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <EffectsField label={gameUi("When the phase starts")} value={phase.onEnter} onChange={(onEnter) => update((draft) => void (draft.onEnter = onEnter))} />
          {mode === "advanced" && <EffectsField label={gameUi("When the phase ends")} value={phase.onExit} onChange={(onExit) => update((draft) => void (draft.onExit = onExit))} />}
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{gameUi("Then go to (first match wins, checked after every action)")}</p>
            <ul className="space-y-2">
              {phase.transitions.map((transition, transitionIndex) => (
                <li key={transitionIndex} className="flex flex-wrap items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2">
                  <select aria-label={gameUi("Next phase")} className={`${inputClass} !w-auto py-1 text-xs`} value={transition.to} onChange={(event) => update((draft) => void (draft.transitions[transitionIndex].to = event.target.value))}>
                    {def.phases.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        → {gameUi(entry.name)}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 text-xs text-zinc-500">{gameUi("when")}</span>
                  <OptionalCondition value={transition.when} emptyLabel="always" onChange={(when) => update((draft) => void (when ? (draft.transitions[transitionIndex].when = when) : delete draft.transitions[transitionIndex].when))} />
                  <button type="button" aria-label={gameUi("Remove transition")} className="ml-auto text-xs text-zinc-500 hover:text-red-300" onClick={() => update((draft) => void draft.transitions.splice(transitionIndex, 1))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" className="mt-2" onClick={() => update((draft) => void draft.transitions.push({ to: def.phases[(index + 1) % def.phases.length].id }))}>
              <Plus size={14} />{gameUi(" Transition ")}</Button>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function actorKind(actors: ActorSpec) {
  return actors === "current" || actors === "all" ? actors : "roles";
}

function ActionCard({ action, index }: { action: ActionDefinition; index: number }) {
  useGameLanguage();
  const { def, edit } = useCardEditor();
  const issues = useIssuesFor(action.id);
  const [open, setOpen] = useState(false);
  const update = (mutate: (draft: ActionDefinition) => void) => edit((draft) => mutate(draft.actions[index]));
  const shape = ACTION_TYPE_SHAPE[action.type];
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {gameUi(action.label)} <Chip tone="sky">{gameUi(action.type)}</Chip>
        </span>
      }
      actions={
        <>
          <Button size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Close" : "Edit"}
          </Button>
          <button type="button" aria-label={`Delete action ${action.label}`} className="p-1 text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void draft.actions.splice(index, 1))}>
            <Trash2 size={14} />
          </button>
        </>
      }
    >
      <p className="text-sm text-zinc-400">{gameUi(describeAction(action, { def }))}</p>
      <div className="mt-2">
        <IssueList issues={issues} />
      </div>
      {gameUi(open && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={gameUi("Button label")}>
              <input className={inputClass} value={action.label} onChange={(event) => update((draft) => void (draft.label = event.target.value))} />
            </Field>
            <Field label={gameUi("Id")}>
              <input className={`${inputClass} font-mono`} value={action.id} onChange={(event) => update((draft) => void (draft.id = ident(event.target.value)))} />
            </Field>
            <Field label={gameUi("Type")}>
              <select className={inputClass} value={action.type} onChange={(event) => update((draft) => void (draft.type = event.target.value as ActionDefinition["type"]))}>
                {ACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {gameUi(type)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">{gameUi(" Who may use it: ")}<select aria-label={gameUi("Who may use it")} className={`${inputClass} !w-auto py-1 text-xs`} value={actorKind(action.actors)} onChange={(event) => update((draft) => void (draft.actors = event.target.value === "roles" ? { roles: [def.roles?.[0] ?? "player"] } : (event.target.value as ActorSpec)))}>
              <option value="current">{gameUi("the current player")}</option>
              <option value="all">{gameUi("any active player")}</option>
              <option value="roles">{gameUi("players with a role…")}</option>
            </select>
            {typeof action.actors === "object" && <RoleInput value={action.actors.roles[0] ?? ""} onChange={(role) => update((draft) => void (draft.actors = { roles: [role] }))} />}
          </div>
          {gameUi(shape !== "none" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={gameUi("Card comes from")}>
                <ZoneIdSelect value={action.source} onChange={(source) => update((draft) => void (draft.source = source))} />
              </Field>
              <Field label={gameUi("Card goes to")}>
                <ZoneRefEditor value={action.destination} onChange={(destination) => update((draft) => void (draft.destination = destination))} />
              </Field>
            </div>
          ))}
          {gameUi(shape === "cardAndTarget" && (
            <div className="flex flex-wrap items-start gap-2 text-sm text-zinc-300">{gameUi(" Target a card in ")}<ZoneRefEditor value={action.target?.zone} onChange={(zone) => update((draft) => void (draft.target = { ...draft.target, zone }))} />{gameUi(" where ")}<OptionalCondition value={action.target?.where} emptyLabel="any card" onChange={(where) => update((draft) => void (draft.target = { zone: draft.target?.zone ?? { zone: def.zones[0].id }, ...(where ? { where } : {}) }))} />
            </div>
          ))}
          <div className="flex flex-wrap items-start gap-2 text-sm text-zinc-300">{gameUi(" Available when ")}<OptionalCondition value={action.condition} onChange={(condition) => update((draft) => void (condition ? (draft.condition = condition) : delete draft.condition))} />
          </div>
          {gameUi(shape !== "none" && (
            <div className="flex flex-wrap items-start gap-2 text-sm text-zinc-300">{gameUi(" The card is allowed if ")}<OptionalCondition value={action.cardCondition} emptyLabel="any card" onChange={(cardCondition) => update((draft) => void (cardCondition ? (draft.cardCondition = cardCondition) : delete draft.cardCondition))} />
            </div>
          ))}
          <EffectsField label={gameUi("Then")} value={action.effects} onChange={(effects) => update((draft) => void (draft.effects = effects))} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">{gameUi(" Test bots pick this ")}<NumberField value={action.botWeight ?? 1} min={0} max={100} label={gameUi("Bot weight")} onChange={(botWeight) => update((draft) => void (botWeight === 1 ? delete draft.botWeight : (draft.botWeight = botWeight)))} />
            <span className="text-xs text-zinc-500">{gameUi("× as often as other buttons (0 = only as a last resort; card plays always come first)")}</span>
          </div>
        </div>
      ))}
    </Panel>
  );
}

export function PhasesSection() {
  useGameLanguage();
  const { def, edit, mode } = useCardEditor();
  return (
    <SectionShell
      section="phases"
      eyebrow="6 · Turn phases"
      title={gameUi("Turn phases & actions")}
      description={gameUi("A round moves through phases. Each phase lists what players may do; transitions decide when the game moves on. Actions are the buttons players press.")}
      actions={
        <Button size="sm" onClick={() => edit((draft) => void draft.phases.push({ id: uniqueId("phase", draft.phases.map((phase) => phase.id)), name: "New phase", allowedActions: [], onEnter: [], transitions: [] }))}>
          <Plus size={14} /> Add phase
        </Button>
      }
    >
      <ol aria-label={gameUi("Phase order")} className="flex flex-wrap items-center gap-2 text-sm">
        {def.phases.map((phase, index) => (
          <li key={phase.id} className="flex items-center gap-2">
            <span className={`rounded-lg border px-2.5 py-1 ${phase.automatic ? "border-violet-400/30 text-violet-200" : "border-amber-300/30 text-amber-100"}`}>{phase.name}</span>
            {index < def.phases.length - 1 && <span className="text-zinc-600">→</span>}
          </li>
        ))}
      </ol>
      <div className="space-y-3">
        {def.phases.map((phase, index) => (
          <PhaseCard key={`${phase.id}-${index}`} phase={phase} index={index} />
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 pt-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80">{gameUi("Actions")}</p>
          <h3 className="mt-1 text-xl font-bold text-white">{gameUi("What players can do")}</h3>
        </div>
        <Button size="sm" onClick={() => edit((draft) => void draft.actions.push({ id: uniqueId("action", draft.actions.map((action) => action.id)), type: "playCard", label: "Play", actors: "current", source: draft.zones.find((zone) => zone.owner === "player")?.id, destination: { zone: draft.zones.find((zone) => zone.owner === "game")?.id ?? "" }, effects: [] }))}>
          <Plus size={14} />{gameUi(" Add action ")}</Button>
      </div>
      {mode === "basic" && <p className="text-sm text-zinc-500">{gameUi("Tip: switch to Advanced mode to change card conditions, targets and ids.")}</p>}
      <div className="grid gap-3 xl:grid-cols-2">
        {def.actions.map((action, index) => (
          <ActionCard key={`${action.id}-${index}`} action={action} index={index} />
        ))}
      </div>
    </SectionShell>
  );
}
