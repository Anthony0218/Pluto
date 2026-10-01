import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, LayoutGrid, Plus, Swords, Trash2, Users } from "lucide-react";
import { useMemo } from "react";
import { createCrossBoard, createTeam, luminance, MAX_TEAMS, SIDE_FORWARD, sideOf, TEAM_COLORS, type TeamSide } from "@/games/chess/custom/engine/teams";
import type { TeamDefinition } from "@/games/chess/custom/engine/types";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import Board2D from "../Board2D";
import PieceToken from "../PieceToken";
import { Button, Chip, IconButton, Panel, SectionHeading, Segmented, inputClass, labelClass } from "../ui";

const SIDE_LABELS: Record<TeamSide, string> = { bottom: "Bottom", top: "Top", left: "Left", right: "Right" };
const ORDINALS = ["1st", "2nd", "3rd", "4th"];

/** Pick the side a team plays from: a tiny board with a button on each edge. */
function SidePicker({ team, onChange }: { team: TeamDefinition; onChange: (side: TeamSide) => void }) {
  const current = sideOf(team);
  const edge = (side: TeamSide, Icon: typeof ArrowUp, area: string) => (
    <button
      type="button"
      aria-pressed={current === side}
      title={`${ui("Plays from:")} ${ui(SIDE_LABELS[side])}`}
      aria-label={`${ui("Plays from:")} ${ui(SIDE_LABELS[side])}`}
      onClick={() => onChange(side)}
      className={`${area} flex items-center justify-center rounded-md border transition ${current === side ? "border-sky-400/70 bg-sky-400/20 text-sky-100" : "border-white/10 text-zinc-500 hover:text-white"}`}
    >
      <Icon size={13} />
    </button>
  );
  // The arrow shows the direction the army advances.
  return (
    <div className="grid h-20 w-20 shrink-0 grid-cols-[18px_1fr_18px] grid-rows-[18px_1fr_18px] gap-0.5">
      {edge("top", ArrowDown, "col-start-2 row-start-1")}
      {edge("left", ArrowRight, "col-start-1 row-start-2")}
      <span className="col-start-2 row-start-2 rounded-sm bg-[repeating-conic-gradient(#3f3f46_0_25%,#18181b_0_50%)] bg-[length:12px_12px]" aria-hidden="true" />
      {edge("right", ArrowLeft, "col-start-3 row-start-2")}
      {edge("bottom", ArrowUp, "col-start-2 row-start-3")}
    </div>
  );
}

function TeamCard({ team, index, count }: { team: TeamDefinition; index: number; count: number }) {
  const { variant, dispatch } = useEditor();
  const update = (patch: Partial<TeamDefinition>, coalesceKey?: string) => dispatch({ type: "updateTeam", id: team.id, patch, coalesceKey: coalesceKey && `${team.id}-${coalesceKey}` });
  const pieces = variant.setup.pieces.filter((piece) => piece.team === team.id).length;
  const king = variant.pieces.find((piece) => piece.royal) ?? variant.pieces[0];

  return (
    <article className="rounded-2xl border border-white/[0.09] bg-[#0d1014]/90 p-4" style={{ boxShadow: `inset 3px 0 0 ${team.color}` }}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col items-center gap-1">
          <span className="h-11 w-11">
            <PieceToken def={king} team={team} />
          </span>
          <Chip tone="amber" title={ui("Turn order")}>
            {ui(ORDINALS[index] ?? `${index + 1}`)}
          </Chip>
        </div>
        <div className="min-w-[180px] flex-1 space-y-3">
          <label className="block">
            <span className={labelClass}>{ui("Team name")}</span>
            <input value={team.name} maxLength={24} onChange={(event) => update({ name: event.target.value }, "name")} className={`${inputClass} mt-1.5`} />
          </label>
          <label className="block">
            <span className={labelClass}>{ui("Alliance")}</span>
            <input value={team.alliance ?? ""} maxLength={24} placeholder={ui("Independent")} onChange={(event) => update({ alliance: event.target.value || undefined }, "alliance")} onBlur={(event) => update({ alliance: event.target.value.trim() || undefined }, "alliance")} className={`${inputClass} mt-1.5`} />
            <span className="mt-1 block text-xs text-zinc-500">{ui("Use the same alliance name for partners. With friendly fire off, they cannot capture each other. They share victory, even after elimination.")}</span>
          </label>
          <div>
            <p className={labelClass}>{ui("Colour")}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {TEAM_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${ui("Colour")} ${color}`}
                  aria-pressed={team.color.toLowerCase() === color}
                  onClick={() => update({ color, modelSet: luminance(color) > 0.5 ? "light" : "dark" })}
                  className={`h-7 w-7 rounded-full border-2 transition ${team.color.toLowerCase() === color ? "scale-110 border-amber-300" : "border-white/20 hover:border-white/50"}`}
                  style={{ background: color }}
                />
              ))}
              <input type="color" aria-label={ui("Custom colour")} value={team.color} onChange={(event) => update({ color: event.target.value }, "color")} className="h-7 w-9 cursor-pointer rounded-md border border-white/10 bg-black/40 p-0.5" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={labelClass}>{ui("3D pieces")}</span>
            <Segmented
              size="sm"
              label="3D piece set"
              value={team.modelSet}
              onChange={(modelSet) => update({ modelSet })}
              options={[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <SidePicker team={team} onChange={(side) => update({ forward: SIDE_FORWARD[side] })} />
          <span className="text-[11px] text-zinc-500">{ui(SIDE_LABELS[sideOf(team)])}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <IconButton label={ui("Move earlier in turn order")} disabled={index === 0} onClick={() => dispatch({ type: "moveTeam", id: team.id, delta: -1 })}>
            <ChevronUp size={15} />
          </IconButton>
          <IconButton label={ui("Move later in turn order")} disabled={index === count - 1} onClick={() => dispatch({ type: "moveTeam", id: team.id, delta: 1 })}>
            <ChevronDown size={15} />
          </IconButton>
          <IconButton label={count <= 2 ? ui("A game needs at least two teams") : ui("Remove team and its pieces")} disabled={count <= 2} onClick={() => dispatch({ type: "removeTeam", id: team.id })}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {pieces} {ui("pieces in the starting position")}
      </p>
    </article>
  );
}

export default function TeamsSection() {
  const { variant, dispatch, goToStep } = useEditor();
  const theme = getBoardTheme(variant.theme.boardTheme);
  const bySide = useMemo(() => {
    const map: Record<TeamSide, TeamDefinition[]> = { bottom: [], top: [], left: [], right: [] };
    for (const team of variant.teams) map[sideOf(team)].push(team);
    return map;
  }, [variant.teams]);
  const pieces = useMemo(() => variant.setup.pieces.map((piece, index) => ({ ...piece, key: String(index) })), [variant.setup.pieces]);
  const smallForFour = variant.teams.length > 2 && (variant.board.width < 12 || variant.board.height < 12);

  const sideLabel = (side: TeamSide, vertical = false) => (
    <div className={`flex items-center justify-center gap-1.5 ${vertical ? "flex-col" : "flex-wrap"}`}>
      {bySide[side].length === 0 ? (
        <span className="text-[11px] text-zinc-700">{ui("empty")}</span>
      ) : (
        bySide[side].map((team) => (
          <span key={team.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-zinc-200" style={vertical ? { writingMode: "vertical-rl" } : undefined}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: team.color }} />
            {team.name}
          </span>
        ))
      )}
    </div>
  );

  return (
    <div>
      <SectionHeading
        step="teams"
        eyebrow="Teams"
        title="Who plays, and from where"
        description={ui("Up to four teams. Each team plays from one side of the board and its pieces advance away from it; turn order follows the list.")}
        actions={
          <Button tone="primary" disabled={variant.teams.length >= MAX_TEAMS} onClick={() => dispatch({ type: "addTeam", team: createTeam(variant.teams) })} title={variant.teams.length >= MAX_TEAMS ? ui("Four teams is the maximum") : undefined}>
            <Plus size={15} />
            {ui("Add team")}
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        <div className="space-y-3">
          {variant.teams.map((team, index) => (
            <TeamCard key={team.id} team={team} index={index} count={variant.teams.length} />
          ))}
        </div>
        <div className="space-y-4">
          <Panel title={ui("Table layout")} eyebrow={ui("Starting position")}>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <div className="col-start-2 row-start-1">{sideLabel("top")}</div>
              <div className="col-start-1 row-start-2">{sideLabel("left", true)}</div>
              <div className="col-start-2 row-start-2">
                <Board2D board={variant.board} variant={variant} theme={theme} pieces={pieces} showCoords={false} label={ui("Starting position by team")} />
              </div>
              <div className="col-start-3 row-start-2">{sideLabel("right", true)}</div>
              <div className="col-start-2 row-start-3">{sideLabel("bottom")}</div>
            </div>
            <div className="mt-4 space-y-2">
              <Button className="w-full" tone="blue" onClick={() => dispatch({ type: "arrangeArmies" })}>
                <Swords size={15} />
                {ui("Arrange armies")}
              </Button>
              <p className="text-xs leading-5 text-zinc-500">{ui("Places a standard army for every team along its own side, replacing the starting position. Fine-tune it in Test Position.")}</p>
              {smallForFour && (
                <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3 text-xs text-amber-100">
                  <p>{ui("Side armies need room: a 14×14 cross-shaped board fits four armies.")}</p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => dispatch({ type: "updateBoard", board: createCrossBoard(14, 3) })}
                  >
                    <LayoutGrid size={13} />
                    {ui("Use a 14×14 cross board")}
                  </Button>
                </div>
              )}
              <Button className="w-full" onClick={() => goToStep("position")}>
                <Users size={15} />
                {ui("Fine-tune in Position")}
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
