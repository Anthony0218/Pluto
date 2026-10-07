import {
  CouncilConnection,
  councilAction,
  savedCouncil,
} from "../../../games/MedievalKingdoms/edravane/network.ts";
import type {
  CouncilView,
  CouncilRequest,
} from "../../../games/MedievalKingdoms/edravane/multiplayer.ts";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  activeTurnHouse,
  defendingArmies,
} from "../../../games/MedievalKingdoms/edravane/turns.ts";
import { TerrainTile } from "./TerrainTile";
import { HouseProfile } from "./HouseProfile";
import { CharacterPortrait } from "./CharacterPortrait.tsx";
import { WarActions } from "./WarActions";
import { InsultAction } from "./InsultAction.tsx";
import {
  BattleOutcome,
  BattleRoundPanel,
  UnitGuide,
} from "./BattleRoundPanel.tsx";
import {
  armyLoyalty,
  routeBlockers,
  WAR_REASONS,
} from "../../../games/MedievalKingdoms/edravane/politics.ts";
import {
  castleBonus,
  castleGuard,
  harvestYield,
  HARVEST_COOLDOWN,
} from "../../../games/MedievalKingdoms/edravane/estates.ts";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Crown,
  Flag,
  Swords,
  Anchor,
  ChevronRight,
  Save,
  ZoomOut,
  Shield,
  Coins,
  Leaf,
  Plus,
  Minus,
} from "lucide-react";
import {
  dispatchCommand,
  runAutomaticTurns,
  advanceTactical,
  canControl,
  createCampaign,
  heir,
  loadSave,
  SAVE_KEY,
} from "../../../games/MedievalKingdoms/edravane/simulation.ts";
import {
  BIOMES,
  center,
  NATIONS,
  RESOURCES,
} from "../../../games/MedievalKingdoms/edravane/world.ts";
import {
  battlefield,
  troopCount,
  woundedCount,
  armyHealth,
  UNIT_STATS,
} from "../../../games/MedievalKingdoms/edravane/battle.ts";
import type {
  Campaign,
  Command,
  District,
  House,
  OrderKind,
  Resource,
  UnitKind,
} from "../../../games/MedievalKingdoms/edravane/types.ts";
import "./edravane.css";
const points = (d: District, inset = 0) => {
  const [x, y] = center(d);
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return `${x + (25 - inset) * Math.cos(a)},${y + (25 - inset) * Math.sin(a)}`;
  }).join(" ");
};
const money = (n: number) => Math.floor(n).toLocaleString();
const unitKinds: UnitKind[] = [
  "levies",
  "spearmen",
  "archers",
  "heavy",
  "cavalry",
];
const labels: Record<UnitKind, string> = {
  levies: "Footsoldiers",
  spearmen: "Spearmen",
  archers: "Archers",
  heavy: "Heavy infantry",
  cavalry: "Cavalry",
};
export default function EdravanePage() {
  const [state, setState] = useState<Campaign | null>(null),
    [nation, setNation] = useState("auremarch"),
    [selection, setSelected] = useState<string | null>(null),
    [selectedHouse, setSelectedHouse] = useState<string | null>(null),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [panelExpanded, setPanelExpanded] = useState(false),
    [inspectedReaction, setInspectedReaction] = useState(""),
    [region, setRegion] = useState(false),
    [mapZoom, setMapZoom] = useState(1),
    [mapPanning, setMapPanning] = useState(false),
    [mapCenter, setMapCenter] = useState<[number, number]>([460, 310]),
    [requestedTab, setTab] = useState("district"),
    [overlay, setOverlay] = useState("terrain"),
    [armySelection, setArmy] = useState(""),
    [message, setMessage] = useState(""),
    [reduced, setReduced] = useState(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [lobby, setLobby] = useState<CouncilView | null>(null),
    [online, setOnline] = useState(false),
    [netStatus, setNetStatus] = useState(""),
    [code, setCode] = useState(""),
    [player, setPlayer] = useState(""),
    [name, setName] = useState("Ruler"),
    [networkMenu, setNetworkMenu] = useState(false),
    [resource, setResource] = useState<Resource>("grain"),
    [maritime, setMaritime] = useState(false),
    [importCargo, setImportCargo] = useState(false),
    [destination, setDestination] = useState(""),
    [formation, setFormation] = useState(""),
    [order, setOrder] = useState<OrderKind>("move"),
    [facing, setFacing] = useState(0),
    [width, setWidth] = useState(12),
    [target, setTarget] = useState<[number, number]>([50, 50]),
    [hiddenBattle, setHiddenBattle] = useState("");
  const [dismissedBattleReport, setDismissedBattleReport] = useState("");
  const connection = useRef<CouncilConnection | null>(null),
    connectionAttempt = useRef(0),
    networkPanel = useRef<HTMLElement | null>(null),
    mapElement = useRef<SVGSVGElement | null>(null),
    mapDrag = useRef<{
      point: [number, number];
      center: [number, number];
      moved: boolean;
    } | null>(null),
    file = useRef<HTMLInputElement | null>(null);
  const campaignStarted = !!state;
  const lobbySlot = lobby?.slots.find((s) => s.player === player);
  const lobbyReady = !!lobbySlot?.ready;
  const allPlayersReady =
    !!lobby && lobby.slots.every((s) => s.bot || (s.connected && s.ready));
  useEffect(() => {
    if (networkMenu && !campaignStarted)
      networkPanel.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
  }, [networkMenu, lobby?.code, campaignStarted]);
  const view = state ?? createCampaign(nation);
  const house = view.houses.find((h) => h.id === `${nation}-0`)!;
  const actor = { house: house.id };
  const requestedArmy = view.armies.find((a) => a.id === armySelection);
  const army = requestedArmy?.garrison
    ? (view.armies.find(
        (a) => a.house === house.id && !a.garrison && !a.pledgedTo,
      )?.id ?? armySelection)
    : armySelection;
  const activeReaction = view.turns?.pending[0];
  const myResponse = activeReaction?.to === house.id;
  const newThreat =
    myResponse &&
    activeReaction?.hex &&
    inspectedReaction !== activeReaction.id;
  const selected = newThreat ? activeReaction.hex : selection;
  const tab = newThreat ? "district" : requestedTab;
  const hex = view.districts.find((d) => d.id === selected),
    selectedArmy = view.armies.find((a) => a.id === army);
  const profileHouse = view.houses.find((h) => h.id === selectedHouse) ?? house;
  const myTurn =
    activeTurnHouse(view) === house.id &&
    !view.turns?.ending &&
    !activeReaction;
  const canAct =
    myTurn ||
    (myResponse &&
      !!activeReaction &&
      ["war", "attack"].includes(activeReaction.kind));
  const actingHouse = view.houses.find((h) => h.id === activeTurnHouse(view));
  const battle = state?.battles[0],
    field = battle ? battlefield(view, battle) : null;
  const latestBattleReport = view.battleReports?.find((r) =>
    r.sides.some((side) => side.house === house.id),
  );
  function execute(cmd: Command) {
    setMessage("");
    if (online) {
      if (!connection.current) {
        setMessage("Reconnect to regain command.");
        return;
      }
      connection.current.send({ type: "command", command: cmd });
      return;
    }
    setState((s) => {
      if (!s) return s;
      try {
        return dispatchCommand(s, actor, cmd);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Invalid command");
        return s;
      }
    });
  }
  useEffect(() => {
    if (online) return;
    const interval = setInterval(() => {
      setState((s) => {
        if (!s) return s;
        if (s.battles[0]?.rounds) return s;
        if (s.battles.length)
          return runAutomaticTurns(advanceTactical(s, 0.25));
        return s;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [online]);
  useEffect(() => {
    const svg = mapElement.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setMapZoom((z) =>
        Math.max(0.75, Math.min(4, z * (event.deltaY > 0 ? 0.88 : 1.12))),
      );
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [campaignStarted]);
  function resetCamera() {
    setMapZoom(1);
    setMapCenter([460, 310]);
    setRegion(false);
  }
  function panMap(dx: number, dy: number) {
    setMapPanning(false);
    setMapCenter(([x, y]) => [
      Math.max(0, Math.min(920, x + (dx * 90) / mapZoom)),
      Math.max(0, Math.min(620, y + (dy * 90) / mapZoom)),
    ]);
  }
  function mapKey(e: React.KeyboardEvent) {
    const direction: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const delta = direction[e.key];
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    panMap(...delta);
  }
  function mapPoint(
    svg: SVGSVGElement,
    x: number,
    y: number,
  ): [number, number] {
    const matrix = svg.getScreenCTM();
    if (!matrix) return [x, y];
    const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }
  useEffect(
    () => () => {
      connectionAttempt.current++;
      connection.current?.close();
    },
    [],
  );
  function start() {
    connectionAttempt.current++;
    setDismissedBattleReport("");
    connection.current?.close();
    setLobby(null);
    setOnline(false);
    resetCamera();
    setState(createCampaign(nation));
    setSelected(NATIONS.find((n) => n.id === nation)!.capital);
    setArmy(`army-${nation}-0`);
    setMessage(
      "Your turn. Raise a field host at your seat, plan your actions, then End turn.",
    );
  }
  function resume() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) throw Error("No Edravane save yet");
      const s = loadSave(raw);
      setDismissedBattleReport("");
      const human = s.houses.find((h) => h.reasons.includes("Human commander"));
      if (!human) throw Error("Save has no human commander");
      setNation(human.nation);
      resetCamera();
      setState(runAutomaticTurns(s));
      setSelected(NATIONS.find((n) => n.id === human.nation)!.capital);
      setArmy(`army-${human.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function save() {
    if (!state || online) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      setMessage("Saved Edravane v2. Legacy progress is preserved.");
    } catch {
      setMessage("Storage full. Use Export save.");
    }
  }
  function exportSave() {
    if (!state || online) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "edravane-v2.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function connect(action: "create" | "join" | "resume") {
    const attempt = ++connectionAttempt.current;
    connection.current?.close(action !== "resume");
    connection.current = null;
    setNetStatus("Connecting…");
    setMessage("");
    try {
      const roomCode = action === "resume" ? savedCouncil() : code.trim();
      if (action === "resume" && !roomCode)
        throw Error("No saved Supabase council in this browser tab.");
      const initial = await councilAction({
        type: action,
        code: roomCode ?? undefined,
        nation,
        name,
      });
      if (attempt !== connectionAttempt.current) return;
      resetCamera();
      setOnline(true);
      let selectedNation: string | undefined;
      connection.current = new CouncilConnection(
        initial,
        (reply) => {
          setPlayer(reply.player);
          setNation(reply.nation);
          setCode(reply.room.code);
          if (reply.nation !== selectedNation) {
            setArmy(`army-${reply.nation}-0`);
            selectedNation = reply.nation;
          }
          setSelected(
            (current) =>
              current ?? NATIONS.find((n) => n.id === reply.nation)!.capital,
          );
          setLobby(reply.room);
          setState(reply.room.state);
        },
        setNetStatus,
        setMessage,
      );
    } catch (cause) {
      if (attempt !== connectionAttempt.current) return;
      const error =
        cause instanceof Error
          ? cause.message
          : "Could not connect to the Supabase council";
      setMessage(error);
      setNetStatus(error);
    }
  }
  const netSend = (message: CouncilRequest) =>
    connection.current?.send(message);
  function select(d: District) {
    setSelected(d.id);
    setInspectedReaction(activeReaction?.id ?? "");
    setSidebarOpen(true);
    setTab("district");
  }
  function visitHouse(h: House) {
    const seat =
      view.districts.find((d) => d.owner === h.id && d.seat === "capital") ??
      view.districts.find((d) => d.owner === h.id);
    setSelectedHouse(h.id);
    setPanelExpanded(true);
    setInspectedReaction(activeReaction?.id ?? "");
    setTab("houses");
    setSidebarOpen(true);
    if (seat) {
      setSelected(seat.id);
      setMapCenter(center(seat));
      setMapZoom(1.8);
      setRegion(true);
    }
  }
  function map(mini = false) {
    const zoom = mini ? 1 : mapZoom;
    const c = mini ? [460, 310] : mapCenter;
    return (
      <svg
        ref={mini ? undefined : mapElement}
        onPointerDown={
          mini
            ? undefined
            : (e) => {
                if (e.button !== 0) return;
                setMapPanning(false);
                mapDrag.current = {
                  point: mapPoint(e.currentTarget, e.clientX, e.clientY),
                  center: mapCenter,
                  moved: false,
                };
              }
        }
        onPointerMove={
          mini
            ? undefined
            : (e) => {
                const drag = mapDrag.current;
                if (!drag || !e.buttons) return;
                const point = mapPoint(e.currentTarget, e.clientX, e.clientY);
                const dx = point[0] - drag.point[0],
                  dy = point[1] - drag.point[1];
                if (Math.abs(dx) + Math.abs(dy) < 3) return;
                drag.moved = true;
                setMapPanning(true);
                e.currentTarget.setPointerCapture(e.pointerId);
                setMapCenter([
                  Math.max(0, Math.min(920, drag.center[0] - dx / mapZoom)),
                  Math.max(0, Math.min(620, drag.center[1] - dy / mapZoom)),
                ]);
              }
        }
        onPointerUp={
          mini
            ? undefined
            : (e) => {
                setMapPanning(false);
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }
        }
        onPointerCancel={
          mini
            ? undefined
            : () => {
                mapDrag.current = null;
                setMapPanning(false);
              }
        }
        onKeyDown={mini ? undefined : mapKey}
        tabIndex={mini ? undefined : 0}
        aria-keyshortcuts={
          mini ? undefined : "ArrowUp ArrowDown ArrowLeft ArrowRight"
        }
        onClickCapture={
          mini
            ? undefined
            : (e) => {
                if (mapDrag.current?.moved) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                mapDrag.current = null;
              }
        }
        className={mini ? "ed-minimap" : "ed-world-svg"}
        viewBox="0 0 920 620"
        role={mini ? "img" : "group"}
        aria-label={mini ? "World minimap" : "Interactive hex map of Edravane"}
      >
        <defs>
          <pattern
            id={mini ? "mini-occupation" : "occupation"}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke="#fff1bf"
              strokeWidth="2"
            />
          </pattern>
          <pattern
            id={mini ? "mini-water" : "water"}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M2 12 Q6 8 10 12 T18 12"
              fill="none"
              stroke="#76b4bd"
              opacity=".2"
            />
          </pattern>
          <pattern
            id={mini ? "mini-legacy" : "legacy-image"}
            width="120"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <image
              href="/MedievalKingdoms/maps/continent.png"
              width="120"
              height="80"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        </defs>
        <rect width="920" height="620" fill="#193942" />
        <rect
          width="920"
          height="620"
          fill={`url(#${mini ? "mini-water" : "water"})`}
        />
        <g
          style={{
            transform: mini
              ? ""
              : `translate(${460 - c[0] * zoom}px, ${310 - c[1] * zoom}px) scale(${zoom})`,
            transition: mapPanning
              ? "none"
              : reduced
                ? "none"
                : "transform 180ms ease-out",
          }}
        >
          {view.districts.map((d) => {
            const owner = view.houses.find((h) => h.id === d.owner),
              owned = owner?.id === house.id;
            const [x, y] = center(d);
            let fill = BIOMES[d.biome].color;
            if (overlay === "loyalty" && owner)
              fill =
                owner.loyalty < 40
                  ? "#94665e"
                  : owner.loyalty < 65
                    ? "#a99660"
                    : "#6a987e";
            if (overlay === "ownership" && owner) fill = BIOMES[d.biome].color;
            return (
              <g
                key={d.id}
                onClick={() => select(d)}
                role={!mini ? "button" : undefined}
                tabIndex={!mini ? 0 : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") select(d);
                }}
                aria-label={`${d.name}, ${owner?.name ?? d.biome}`}
                className={!mini ? "ed-hex" : ""}
              >
                <title>
                  {d.name} · {owner?.name ?? d.biome} ·{" "}
                  {BIOMES[d.biome].description}
                  {d.city ? ` · ${d.city} city` : ""}
                  {d.castle ? ` · level ${d.castle.level} castle` : ""}
                </title>
                <polygon
                  points={points(d)}
                  fill={
                    d.biome === "legacy"
                      ? `url(#${mini ? "mini-legacy" : "legacy-image"})`
                      : fill
                  }
                  stroke="#182e27"
                  strokeWidth=".55"
                  fillOpacity={1}
                />
                {overlay === "ownership" && owner && (
                  <polygon
                    points={points(d)}
                    fill={owner.color}
                    opacity=".18"
                    pointerEvents="none"
                  />
                )}
                {!mini && d.biome !== "legacy" && (
                  <g transform={`translate(${x},${y})`}>
                    <TerrainTile d={d} />
                  </g>
                )}
                {d.owner && (
                  <polygon
                    points={points(d, 1.4)}
                    fill="none"
                    stroke={owned ? "#f6d97b" : owner!.color}
                    strokeWidth={owned ? 2 : 1.2}
                  />
                )}
                {d.occupation && (
                  <polygon
                    points={points(d, 2)}
                    fill={`url(#${mini ? "mini-occupation" : "occupation"})`}
                    opacity=".5"
                  />
                )}
                {d.disputed && (
                  <polygon
                    points={points(d, 3)}
                    fill="none"
                    stroke="#ede0c3"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                  />
                )}
                {!mini && (overlay === "resources" || d.biome === "legacy") && (
                  <text
                    x={x}
                    y={y + 5}
                    textAnchor="middle"
                    fontSize={d.biome === "legacy" ? 12 : 10}
                    fill="#132b28"
                    opacity=".8"
                  >
                    {d.biome === "legacy"
                      ? "🔒"
                      : overlay === "resources"
                        ? {
                            grain: "♧",
                            timber: "♣",
                            iron: "◆",
                            livestock: "♘",
                            horses: "♞",
                            herbs: "✿",
                            luxury: "✧",
                          }[d.resource]
                        : BIOMES[d.biome].icon}
                  </text>
                )}
                {!mini && owned && (
                  <text x={x - 10} y={y - 8} fontSize="8" fill="#fff0aa">
                    ♛
                  </text>
                )}
                {!mini && region && (
                  <>
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize="5"
                      fill="#14271d"
                    >
                      {d.settlement === "Hamlet"
                        ? `${owner?.crest ?? ""} ${owner?.name ?? ""}`
                        : d.settlement}
                    </text>
                    {d.port && (
                      <text x={x + 12} y={y + 14} fontSize="8">
                        ⚓
                      </text>
                    )}
                  </>
                )}
                {!mini && d.bonus && (
                  <circle
                    cx={x + 12}
                    cy={y - 11}
                    r="3.5"
                    fill={d.bonus === "gold" ? "#ffdf6d" : "#e4edf0"}
                    stroke="#49493c"
                  />
                )}
              </g>
            );
          })}
          {/* Borders follow actual shared hex edges, at estate and nation scales. */}
          {view.districts
            .filter((d) => d.owner)
            .flatMap((d) => {
              const [x, y] = center(d);
              return Array.from({ length: 6 }, (_, i) => {
                const a = ((60 * i - 30) * Math.PI) / 180,
                  b = ((60 * (i + 1) - 30) * Math.PI) / 180;
                const mx = x + (25 * (Math.cos(a) + Math.cos(b))) / 2,
                  my = y + (25 * (Math.sin(a) + Math.sin(b))) / 2;
                const adjacent = view.districts.find(
                  (n) =>
                    n.id !== d.id &&
                    Math.hypot(
                      center(n)[0] - (x + (mx - x) * 2),
                      center(n)[1] - (y + (my - y) * 2),
                    ) < 1,
                );
                const national =
                    view.houses.find((h) => h.id === adjacent?.owner)
                      ?.nation !==
                    view.houses.find((h) => h.id === d.owner)?.nation,
                  estate = adjacent?.owner !== d.owner;
                if (!estate) return null;
                return (
                  <line
                    key={`${d.id}-${i}`}
                    x1={x + 25 * Math.cos(a)}
                    y1={y + 25 * Math.sin(a)}
                    x2={x + 25 * Math.cos(b)}
                    y2={y + 25 * Math.sin(b)}
                    stroke={national ? "#e8d7b0" : "#293932"}
                    strokeWidth={national ? 2.6 : 1.4}
                  />
                );
              });
            })}
          {!mini &&
            view.routes.map((r) => {
              const path = r.path.map((id) =>
                center(view.districts.find((d) => d.id === id)!),
              );
              const merchant = path[r.progress % path.length];
              return (
                <g key={r.id}>
                  <polyline
                    points={path.map((p) => p.join(",")).join(" ")}
                    fill="none"
                    stroke={r.maritime ? "#6eddeb" : "#ddc68c"}
                    strokeWidth="1.8"
                    strokeDasharray={r.maritime ? "2 4" : "4 3"}
                  />
                  <circle
                    cx={merchant[0]}
                    cy={merchant[1]}
                    r="3"
                    fill={r.maritime ? "#adf6ff" : "#ffdf82"}
                  />
                </g>
              );
            })}
          {!mini &&
            NATIONS.map((n) => {
              const [x, y] = center(
                view.districts.find((d) => d.id === n.capital)!,
              );
              return (
                <g key={n.id} pointerEvents="none">
                  <rect
                    x={x - 48}
                    y={y - 38}
                    width="96"
                    height="17"
                    rx="2"
                    fill="#142c22"
                    opacity=".9"
                  />
                  <text
                    x={x}
                    y={y - 27}
                    textAnchor="middle"
                    fontSize={region ? 8 : 14}
                    fontFamily="Georgia"
                    fontWeight="bold"
                    fill="#fff1cb"
                    stroke="#213e32"
                    strokeWidth="2"
                    paintOrder="stroke"
                  >
                    {n.name.toUpperCase()}
                  </text>
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fontSize="7"
                    fill="#fff1b8"
                  >
                    ♜
                  </text>
                </g>
              );
            })}
          {!mini &&
            view.armies
              .filter(
                (a) =>
                  !a.garrison &&
                  (a.house === house.id ||
                    a.pledgedTo === house.id ||
                    (!region && a.troops.levies >= 80) ||
                    region),
              )
              .map((a, i) => {
                const d = view.districts.find(
                  (d) =>
                    d.id ===
                    (a.voyage?.path[
                      Math.min(a.voyage.progress, a.voyage.path.length - 1)
                    ] ?? a.hex),
                )!;
                const [x, y] = center(d);
                return (
                  <g
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setArmy(a.id);
                      select(view.districts.find((d) => d.id === a.hex)!);
                    }}
                    className="ed-army-marker"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setArmy(a.id);
                        select(view.districts.find((d) => d.id === a.hex)!);
                      }
                    }}
                    aria-label={a.name}
                  >
                    <circle
                      cx={x - 9 + (i % 2) * 8}
                      cy={y + 10}
                      r="7"
                      fill={
                        a.rebel
                          ? "#9d3638"
                          : canControl(view, actor, a)
                            ? "#332b19"
                            : "#344b50"
                      }
                      stroke={a.id === army ? "#fff1a4" : "#ddd2b7"}
                    />
                    <text
                      x={x - 9 + (i % 2) * 8}
                      y={y + 13}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#fff"
                    >
                      ⚔
                    </text>
                    <title>
                      {a.name}: {troopCount(a)} troops
                    </title>
                  </g>
                );
              })}
          {!mini && selected && hex && (
            <polygon
              className="ed-selected-hex"
              points={points(hex, 1)}
              fill="none"
              stroke="#fff1a4"
              strokeWidth="3"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
        </g>
        {!mini && (
          <>
            <text
              x="38"
              y="575"
              fontFamily="Georgia"
              fontSize="13"
              fill="#abc4c2"
              letterSpacing="4"
            >
              THE AZURE SEA
            </text>
            <g transform="translate(860 555)" fill="none" stroke="#cfc39b">
              <path d="M0 -22 L5 0 L0 22 L-5 0Z M-22 0H22" />
              <text x="-4" y="-28" fill="#cfc39b" stroke="none" fontSize="10">
                N
              </text>
            </g>
          </>
        )}
      </svg>
    );
  }
  if (!state)
    return (
      <main className="ed-app ed-start">
        <header className="ed-masthead">
          <Link to="/games">
            <ArrowLeft size={16} /> Games
          </Link>
          <span>
            MEDIEVAL KINGDOMS <b> / </b> A NEW CHRONICLE
          </span>
          <Link to="/games/medieval-kingdoms/legacy">
            Legacy mode <ArrowUpRight size={15} />
          </Link>
        </header>
        <div className="ed-intro">
          <div>
            <span className="ed-eyebrow">EIGHT CROWNS. ONE CONTINENT.</span>
            <h1>
              Edravane
              <span>
                A kingdom is inherited.
                <br />
                An empire is earned.
              </span>
            </h1>
            <p>
              Raise your dynasty, call your banners, and shape the fortunes of a
              living world.
            </p>
          </div>
          <div className="ed-intro-map">{map()}</div>
        </div>
        <section className="ed-selection">
          <div className="ed-section-title">
            <h2>Choose your crown</h2>
            <span>01 — Found a dynasty</span>
          </div>
          <div className="ed-nations">
            {NATIONS.map((n) => (
              <button
                key={n.id}
                className={`ed-nation ${nation === n.id ? "active" : ""}`}
                onClick={() => {
                  if (lobby) netSend({ type: "select", nation: n.id });
                  else setNation(n.id);
                }}
                style={{ "--nation": n.color } as React.CSSProperties}
              >
                <span className="ed-crest">{n.crest}</span>
                <div>
                  <strong>{n.name}</strong>
                  <small>HOUSE {n.house.toUpperCase()}</small>
                  <span>
                    {n.people} · {n.succession}
                  </span>
                </div>
                {nation === n.id && <Crown size={16} />}
              </button>
            ))}
          </div>
          <div className="ed-start-actions">
            <button className="ed-primary" onClick={start}>
              <Crown size={16} /> Begin single-player <ArrowUpRight size={16} />
            </button>
            <button
              aria-expanded={networkMenu}
              aria-controls="ed-network-lobby"
              onClick={() => setNetworkMenu((v) => !v)}
            >
              <Flag size={16} /> Multiplayer council
            </button>
            <button onClick={resume}>Continue saved campaign</button>
            <button onClick={() => file.current?.click()}>Import save</button>
          </div>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (!f) return;
                const s = loadSave(await f.text());
                const h = s.houses.find((h) =>
                  h.reasons.includes("Human commander"),
                );
                if (!h) throw Error("Missing player");
                setNation(h.nation);
                setDismissedBattleReport("");
                resetCamera();
                setState(runAutomaticTurns(s));
              } catch (err) {
                setMessage((err as Error).message);
              }
            }}
          />
          {networkMenu && (
            <section
              className="ed-network"
              id="ed-network-lobby"
              ref={networkPanel}
              aria-label="Multiplayer lobby"
            >
              <h3>Gather the eight banners</h3>
              <p>
                Multiplayer uses your existing Supabase account.{" "}
                <Link to="/login">Log in</Link> to host or join; councils and
                turns are saved automatically.
              </p>
              {!lobby && (
                <>
                  <p>
                    Each crown takes a turn. Use End turn to commit movement and
                    pass control. War, invasion, peace and marriage proposals
                    allow the receiving player to respond. Unoccupied slots are
                    bots. During battles, campaign turns wait for the outcome;
                    both sides commit an order before each round resolves.
                    Production, movement, trade, and challenge cooldowns stay
                    frozen.
                  </p>
                  <div className="ed-form-row">
                    <label>
                      Your name
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label>
                      Room code
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="ed-form-row">
                    <button onClick={() => connect("create")}>
                      Host council
                    </button>
                    <button onClick={() => connect("join")}>
                      Join council
                    </button>
                    <button
                      className="ed-reconnect"
                      onClick={() => connect("resume")}
                    >
                      Reconnect
                    </button>
                    <span>{netStatus}</span>
                  </div>
                </>
              )}
              {lobby && (
                <>
                  <p>
                    Room <strong>{lobby.code}</strong> · share this code with
                    the other players.
                  </p>
                  <div
                    className="ed-form-row ed-lobby-actions"
                    role="group"
                    aria-label="Your lobby controls"
                  >
                    <button
                      className={lobbyReady ? "" : "ed-primary"}
                      aria-pressed={lobbyReady}
                      disabled={
                        !lobbySlot?.connected || netStatus !== "Connected"
                      }
                      onClick={() =>
                        netSend({
                          type: "ready",
                          ready: !lobbyReady,
                        })
                      }
                    >
                      {lobbyReady ? "Cancel ready" : "Ready"}
                    </button>
                    {lobby.host === player && (
                      <>
                        <label>
                          Sea hazard
                          <select
                            value={lobby.settings.maritimeHazard}
                            onChange={(e) =>
                              netSend({
                                type: "settings",
                                tickSeconds: lobby.settings.tickSeconds,
                                maritimeHazard: Number(e.target.value),
                              })
                            }
                          >
                            <option value="0">Calm</option>
                            <option value="0.025">Normal · 2.5%</option>
                            <option value="0.08">Harsh · 8%</option>
                          </select>
                        </label>
                        <button
                          className="ed-primary"
                          disabled={
                            !allPlayersReady || netStatus !== "Connected"
                          }
                          onClick={() => netSend({ type: "start" })}
                        >
                          Start campaign
                        </button>
                      </>
                    )}
                  </div>
                  <p className="ed-lobby-status" role="status">
                    {lobbyReady
                      ? "You are ready."
                      : "Click Ready when you have chosen your crown."}{" "}
                    {allPlayersReady
                      ? lobby.host === player
                        ? "All players are ready. You can start the campaign."
                        : "All players are ready. Waiting for the host to start."
                      : "Waiting for every player, including the host, to be ready."}
                  </p>
                  {netStatus !== "Connected" && (
                    <div className="ed-form-row">
                      <span role="status">{netStatus}</span>
                      <button onClick={() => connect("resume")}>
                        Reconnect
                      </button>
                    </div>
                  )}
                  <div className="ed-slots">
                    {lobby.slots.map((s) => (
                      <div
                        key={s.nation}
                        className={s.player === player ? "ed-slot-self" : ""}
                      >
                        <b>{NATIONS.find((n) => n.id === s.nation)!.name}</b>
                        <span>
                          {s.bot ? "Bot" : s.name}
                          {s.player === player ? " (you)" : ""}
                          {s.player === lobby.host ? " · Host" : ""} ·{" "}
                          {s.ready ? "Ready" : "Not ready"}
                          {s.player && !s.connected ? " · disconnected" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
          {message && (
            <p className="ed-notice" role="status">
              {message}
            </p>
          )}
          <p className="ed-footnote">
            Provisional fictional names · 180 land districts · 40 great and
            minor houses · Legacy progress preserved
          </p>
        </section>
      </main>
    );
  const owner = hex?.owner ? view.houses.find((h) => h.id === hex.owner) : null,
    liege = owner?.liege ? view.houses.find((h) => h.id === owner.liege) : null;
  const fieldEnemy =
    hex &&
    view.armies.find(
      (a) =>
        a.hex === hex.id &&
        troopCount(a) > 0 &&
        (a.rebel ||
          (view.houses.find((h) => h.id === (a.pledgedTo ?? a.house))
            ?.nation !== nation &&
            (a.blockading ||
              view.wars.includes([nation, a.origin].sort().join("|"))))),
    );
  const controlledNation = owner
    ? view.houses.find((h) => h.id === (hex?.occupation ?? owner.id))!.nation
    : undefined;
  const attackNation =
    controlledNation !== nation
      ? controlledNation
      : fieldEnemy
        ? view.houses.find(
            (h) => h.id === (fieldEnemy.pledgedTo ?? fieldEnemy.house),
          )!.nation
        : undefined;
  const activeChallenge = view.challenges.find(
    (c) => c.house === house.id && !c.done,
  );
  const myArmies = view.armies.filter(
    (a) =>
      a.house === house.id ||
      a.pledgedTo === house.id ||
      view.houses.find((h) => h.id === a.house)?.liege === house.id,
  );
  return createPortal(
    <main
      className={`ed-app ed-playing ${sidebarOpen || (myResponse && inspectedReaction !== activeReaction?.id) ? "" : "ed-sidebar-hidden"}`}
    >
      <header className="ed-masthead">
        <Link to="/games">
          <ArrowLeft size={16} /> Games
        </Link>
        <span>
          MEDIEVAL KINGDOMS <b>/</b> EDRAVANE
        </span>
        <Link to="/games/medieval-kingdoms/legacy">
          Legacy mode <ArrowUpRight size={15} />
        </Link>
      </header>
      <div className="ed-topbar">
        <div
          className="ed-dynasty-mark"
          style={{ borderColor: NATIONS.find((n) => n.id === nation)!.color }}
        >
          <Crown />
          <div>
            <h1>{NATIONS.find((n) => n.id === nation)!.name}</h1>
            <span>
              HOUSE {house.name.toUpperCase()} ·{" "}
              {house.family.find((p) => p.id === house.ruler)?.name}
            </span>
          </div>
        </div>
        <div className="ed-stat">
          <small>COINS</small>
          <b>
            <Coins size={15} /> {money(house.treasury)}
          </b>
        </div>
        <div className="ed-stat ed-food-stat">
          <small>FOOD</small>
          <b>
            <Leaf size={15} /> {money(house.stock.grain)}
          </b>
        </div>
        <div className="ed-stat">
          <small>HOUSE TROOPS</small>
          <b>
            <Swords size={15} />{" "}
            {myArmies
              .filter((a) => canControl(view, actor, a))
              .reduce((n, a) => n + troopCount(a), 0)}
          </b>
        </div>
        <div className="ed-stat">
          <small>ROUND / TURN</small>
          <b>
            {view.turns?.round ?? 1} · {actingHouse?.name ?? "Council"}
          </b>
        </div>
        <div className="ed-tools">
          <button
            className="ed-end-turn"
            disabled={!myTurn || !!battle}
            onClick={() => execute({ type: "endTurn" })}
          >
            End turn <ChevronRight size={16} />
          </button>
          <button
            onClick={() => {
              if (!online) save();
              connectionAttempt.current++;
              const previous = connection.current;
              connection.current = null;
              previous?.close();
              setOnline(false);
              setState(null);
              setLobby(null);
              resetCamera();
              setSelected(null);
            }}
          >
            Campaign menu
          </button>
          {online ? (
            <>
              <span className="ed-live">Room {code}</span>
              <span className="ed-live">● {netStatus}</span>
              <button onClick={() => connect("resume")}>Reconnect</button>
            </>
          ) : (
            <>
              <button className="ed-save" onClick={save}>
                <Save size={16} /> Save
              </button>
              <button className="ed-export" onClick={exportSave}>
                Export
              </button>
            </>
          )}
        </div>
      </div>
      <div className="ed-turn-status" role="status">
        {activeReaction && !battle
          ? `${myResponse ? "Your response required" : "Awaiting response"}: ${view.houses.find((h) => h.id === activeReaction.from)?.name} → ${view.houses.find((h) => h.id === activeReaction.to)?.name} · ${activeReaction.kind}`
          : battle
            ? hiddenBattle === battle.id
              ? "Battle in progress · campaign waits"
              : "Battle in progress · campaign turns wait for the outcome"
            : myTurn
              ? "Your turn · plan diplomacy, harvest, raise troops and order movement, then End turn."
              : `${actingHouse?.name ?? "The council"} is taking its turn. You can inspect the map while waiting.`}
        {battle && hiddenBattle === battle.id && (
          <button
            className="ed-battle-return"
            onClick={() => setHiddenBattle("")}
          >
            Return to battle
          </button>
        )}
      </div>
      <div className="ed-workspace">
        <section className="ed-map-card">
          <div className="ed-map-head">
            <div className="ed-trail">
              <button
                onClick={() => {
                  resetCamera();
                  setSelected(null);
                }}
              >
                <ZoomOut size={14} /> World
              </button>
              {region && hex && (
                <>
                  <ChevronRight size={14} />
                  <span>{NATIONS.find((n) => n.id === hex.nation)?.name}</span>
                  <ChevronRight size={14} />
                  <span>{hex.settlement}</span>
                </>
              )}
            </div>
            <span>THE REALMS OF EDRAVANE</span>
          </div>
          <div className="ed-map">
            {map()}
            <div
              className="ed-zoom-controls"
              role="group"
              aria-label="Map zoom controls"
            >
              <button
                aria-label="Zoom out map"
                disabled={mapZoom <= 0.75}
                onClick={() => setMapZoom((z) => Math.max(0.75, z - 0.25))}
              >
                <Minus size={15} />
              </button>
              <span>{Math.round(mapZoom * 100)}%</span>
              <button
                aria-label="Zoom in map"
                disabled={mapZoom >= 4}
                onClick={() => setMapZoom((z) => Math.min(4, z + 0.25))}
              >
                <Plus size={15} />
              </button>
              <button onClick={resetCamera}>Fit map</button>
            </div>
            <div
              className="ed-pan-controls"
              role="group"
              aria-label="Map direction controls"
              onKeyDown={mapKey}
            >
              <button
                aria-label="View map west"
                title="View west · Left arrow"
                disabled={mapCenter[0] <= 0}
                onClick={() => panMap(-1, 0)}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                aria-label="View map north"
                title="View north · Up arrow"
                disabled={mapCenter[1] <= 0}
                onClick={() => panMap(0, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                aria-label="View map south"
                title="View south · Down arrow"
                disabled={mapCenter[1] >= 620}
                onClick={() => panMap(0, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                aria-label="View map east"
                title="View east · Right arrow"
                disabled={mapCenter[0] >= 920}
                onClick={() => panMap(1, 0)}
              >
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="ed-overlay-controls">
              {["terrain", "ownership", "loyalty", "resources", "trade"].map(
                (o) => (
                  <button
                    className={overlay === o ? "active" : ""}
                    key={o}
                    onClick={() => setOverlay(o)}
                  >
                    {o === "ownership" ? (
                      <Shield size={13} />
                    ) : o === "trade" ? (
                      <Anchor size={13} />
                    ) : o === "resources" ? (
                      <Leaf size={13} />
                    ) : (
                      <Flag size={13} />
                    )}{" "}
                    {o}
                  </button>
                ),
              )}
            </div>
            <button
              className="ed-sidebar-toggle"
              onClick={() => {
                setSidebarOpen((v) => !v);
                setInspectedReaction(activeReaction?.id ?? "");
              }}
            >
              {sidebarOpen ||
              (myResponse && inspectedReaction !== activeReaction?.id)
                ? "Hide sidebar"
                : "Show sidebar"}
            </button>
            <div className="ed-map-bottom">
              <div>
                <span>
                  <i className="gold" /> Your estate · ♛
                </span>
                <span>
                  <i className="green" /> Vassal crest
                </span>
                <span>♜ Castle · 500 guards</span>
                <span>⌂ City · trade</span>
                <span>▨ Occupied</span>
                <span>┄ Disputed</span>
                <span>Wheel to zoom · drag or arrows to explore</span>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => setReduced(e.target.checked)}
                />{" "}
                Reduce motion
              </label>
            </div>
            {region && (
              <button className="ed-return" onClick={resetCamera}>
                <ArrowLeft size={14} /> Return to world
              </button>
            )}
          </div>
          <div className="ed-army-bar">
            <Swords size={16} />
            <select
              aria-label="Selected army"
              value={selectedArmy?.garrison ? "" : army}
              onChange={(e) => setArmy(e.target.value)}
            >
              <option value="">
                {view.armies.some(
                  (a) => !a.garrison && canControl(view, actor, a),
                )
                  ? "Select a field army"
                  : "Raise a field army at your seat"}
              </option>
              {view.armies
                .filter(
                  (a) =>
                    !a.garrison &&
                    (canControl(view, actor, a) ||
                      view.houses.find((h) => h.id === a.house)?.liege ===
                        house.id),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ·{" "}
                    {canControl(view, actor, a)
                      ? "Your command"
                      : "Independent"}{" "}
                    · {troopCount(a)}
                  </option>
                ))}
            </select>
            {selectedArmy && !selectedArmy.garrison && (
              <span>
                Loyalty {Math.round(armyLoyalty(view, selectedArmy))}% · Food{" "}
                {Math.round(selectedArmy.supply * 100)}% · Morale{" "}
                {Math.round(selectedArmy.morale)} · {woundedCount(selectedArmy)}{" "}
                wounded · Readiness {armyHealth(selectedArmy)}% ·{" "}
                {selectedArmy.voyage
                  ? "At sea"
                  : selectedArmy.path.length
                    ? "Queued for End turn"
                    : "Stationed"}
              </span>
            )}
            <button
              disabled={
                !canAct ||
                !selectedArmy ||
                selectedArmy.garrison ||
                !hex ||
                !canControl(view, actor, selectedArmy) ||
                !!battle
              }
              onClick={() => execute({ type: "move", army, hex: hex!.id })}
            >
              March here <ArrowUpRight size={14} />
            </button>
            <button
              disabled={
                !canAct ||
                !selectedArmy ||
                selectedArmy.garrison ||
                !hex?.port ||
                !canControl(view, actor, selectedArmy) ||
                !!battle
              }
              onClick={() => execute({ type: "embark", army, hex: hex!.id })}
            >
              <Anchor size={14} /> Sail here
            </button>
            {selectedArmy &&
              !selectedArmy.garrison &&
              canControl(view, actor, selectedArmy) && (
                <button
                  disabled={
                    !myTurn ||
                    !!battle ||
                    !!selectedArmy.voyage ||
                    troopCount(selectedArmy) < 1
                  }
                  onClick={() =>
                    execute({
                      type: "blockade",
                      army,
                      enabled: !selectedArmy.blockading,
                    })
                  }
                >
                  {selectedArmy.blockading
                    ? "Lift blockade"
                    : "Block trade here"}
                </button>
              )}
            <button
              disabled={
                !canAct ||
                !selectedArmy ||
                selectedArmy.garrison ||
                !hex ||
                canControl(view, actor, selectedArmy) ||
                !!battle
              }
              onClick={() => execute({ type: "objective", army, hex: hex!.id })}
            >
              Request objective
            </button>
          </div>
        </section>
        <aside
          className={`ed-panel ${panelExpanded || myResponse ? "ed-panel-expanded" : ""}`}
          aria-label="Kingdom information sidebar"
        >
          {activeReaction && myResponse && !battle && (
            <section
              className="ed-response-card"
              aria-label="Diplomatic or military response"
            >
              <span className="ed-eyebrow">RESPONSE REQUIRED</span>
              {activeReaction.reason && (
                <p className="ed-reason">
                  War reason: {WAR_REASONS[activeReaction.reason]}
                </p>
              )}
              {activeReaction.hex && (
                <div className="ed-threat-info">
                  <strong>
                    {
                      view.districts.find((d) => d.id === activeReaction.hex)
                        ?.name
                    }
                  </strong>
                  <p>
                    Controlled by{" "}
                    {
                      view.houses.find(
                        (h) =>
                          h.id ===
                          (view.districts.find(
                            (d) => d.id === activeReaction.hex,
                          )?.occupation ??
                            view.districts.find(
                              (d) => d.id === activeReaction.hex,
                            )?.owner),
                      )?.name
                    }{" "}
                    ·{" "}
                    {view.armies
                      .filter((a) => a.hex === activeReaction.hex)
                      .reduce((n, a) => n + troopCount(a), 0)
                      .toLocaleString()}{" "}
                    troops
                  </p>
                  <button
                    onClick={() => {
                      select(
                        view.districts.find(
                          (d) => d.id === activeReaction.hex,
                        )!,
                      );
                      setMapCenter(
                        center(
                          view.districts.find(
                            (d) => d.id === activeReaction.hex,
                          )!,
                        ),
                      );
                      setMapZoom(1.8);
                    }}
                  >
                    Inspect threatened hex
                  </button>
                </div>
              )}
              {message && <p role="alert">{message}</p>}
              <h2>
                {activeReaction.kind === "attack"
                  ? `Invasion of ${view.districts.find((d) => d.id === activeReaction.hex)?.settlement}`
                  : activeReaction.kind === "war"
                    ? "A declaration of war"
                    : activeReaction.kind === "peace"
                      ? "A peace offer"
                      : "A proposed marriage pact"}
              </h2>
              <p>
                {view.houses.find((h) => h.id === activeReaction.from)?.name}{" "}
                {activeReaction.kind === "attack"
                  ? "is attacking your territory. Choose a defending force, withdraw, or request peace."
                  : activeReaction.kind === "war"
                    ? "has declared war. You may raise or reinforce troops at your seats before completing your response."
                    : activeReaction.kind === "peace"
                      ? "asks to end the war. Peace requires your consent."
                      : "proposes a marriage pact. The heirs marry only if you accept."}
              </p>
              {activeReaction.kind === "attack" ? (
                <>
                  {defendingArmies(view, activeReaction).map((a) => (
                    <button
                      key={a.id}
                      onClick={() =>
                        execute({
                          type: "respond",
                          reaction: activeReaction.id,
                          choice: "defend",
                          army: a.id,
                        })
                      }
                    >
                      Defend with {a.name} · {troopCount(a).toLocaleString()}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      execute({
                        type: "respond",
                        reaction: activeReaction.id,
                        choice: "withdraw",
                      })
                    }
                  >
                    Move troops out · about 2% losses
                  </button>
                </>
              ) : activeReaction.kind === "war" ? (
                <button
                  onClick={() =>
                    execute({
                      type: "respond",
                      reaction: activeReaction.id,
                      choice: "defend",
                    })
                  }
                >
                  Defenses ready
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      execute({
                        type: "respond",
                        reaction: activeReaction.id,
                        choice: "accept",
                      })
                    }
                  >
                    Accept{" "}
                    {activeReaction.kind === "peace"
                      ? "peace"
                      : "marriage pact"}
                  </button>
                  <button
                    onClick={() =>
                      execute({
                        type: "respond",
                        reaction: activeReaction.id,
                        choice: "decline",
                      })
                    }
                  >
                    Decline proposal
                  </button>
                </>
              )}
              {(activeReaction.kind === "attack" ||
                activeReaction.kind === "war") && (
                <button
                  disabled={
                    activeReaction.negotiated ||
                    !view.wars.includes(
                      [
                        house.nation,
                        view.houses.find((h) => h.id === activeReaction.from)!
                          .nation,
                      ]
                        .sort()
                        .join("|"),
                    )
                  }
                  onClick={() =>
                    execute({
                      type: "respond",
                      reaction: activeReaction.id,
                      choice: "peace",
                    })
                  }
                >
                  Request peace
                </button>
              )}
            </section>
          )}

          <nav className="ed-panel-tabs">
            {["district", "houses", "council", "dynasty", "economy"].map(
              (t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => {
                    setTab(t);
                    setInspectedReaction(activeReaction?.id ?? "");
                  }}
                >
                  {t}
                </button>
              ),
            )}
          </nav>
          <button
            className="ed-panel-size"
            aria-expanded={panelExpanded}
            onClick={() => setPanelExpanded((v) => !v)}
          >
            {panelExpanded ? "Compact sidebar" : "Expand sidebar"}
          </button>
          <button
            className="ed-panel-minimap"
            aria-label="World minimap — return to world"
            onClick={resetCamera}
          >
            {map(true)}
          </button>
          {tab === "district" && (
            <div className="ed-actions-fieldset">
              {hex?.biome === "legacy" ? (
                <section className="ed-legacy-info">
                  <span className="ed-eyebrow">THE OLD KINGDOMS</span>
                  <h2>Legacy Region</h2>
                  <p>
                    The original Medieval Kingdoms campaign, with its own
                    rulers, armies and saved progress.
                  </p>
                  <p className="ed-reason">
                    Legacy Region — unavailable in this campaign. Edravane
                    armies and trade cannot enter it.
                  </p>
                  <Link
                    className="ed-primary ed-visit"
                    to="/games/medieval-kingdoms/legacy"
                  >
                    Visit the old kingdoms <ArrowUpRight size={15} />
                  </Link>
                </section>
              ) : hex && owner ? (
                <>
                  <div className="ed-panel-title">
                    <span className="ed-eyebrow">
                      SELECTED DISTRICT · {hex.id}
                    </span>
                    <h2>{hex.settlement}</h2>
                    <p>{hex.name}</p>
                    <p>
                      <button
                        className="ed-house-link"
                        onClick={() =>
                          visitHouse(
                            view.houses.find(
                              (h) => h.id === (hex.occupation ?? owner.id),
                            )!,
                          )
                        }
                      >
                        House{" "}
                        {
                          view.houses.find(
                            (h) => h.id === (hex.occupation ?? owner.id),
                          )!.name
                        }
                      </button>{" "}
                      ·{" "}
                      {view.armies
                        .filter((a) => a.hex === hex.id)
                        .reduce((n, a) => n + troopCount(a), 0)
                        .toLocaleString()}{" "}
                      troops
                    </p>
                  </div>
                  <div
                    className="ed-terrain"
                    style={{ background: BIOMES[hex.biome].color }}
                  >
                    <span>{BIOMES[hex.biome].icon}</span>
                    <div>
                      <strong>{hex.biome}</strong>
                      <small>{BIOMES[hex.biome].description}</small>
                    </div>
                  </div>
                  <dl className="ed-details">
                    <dt>Troops on hex</dt>
                    <dd>
                      {view.armies
                        .filter((a) => a.hex === hex.id)
                        .reduce((n, a) => n + troopCount(a), 0)
                        .toLocaleString()}{" "}
                      total
                    </dd>
                    <dt>Owner</dt>
                    <dd style={{ color: owner.color }}>
                      <button
                        className="ed-house-link"
                        onClick={() => visitHouse(owner)}
                      >
                        {owner.crest} House {owner.name}
                        {owner.id === house.id ? " · ♛" : ""}
                      </button>
                    </dd>
                    <dt>Liege</dt>
                    <dd>
                      {liege ? (
                        <button
                          className="ed-house-link"
                          onClick={() => visitHouse(liege)}
                        >
                          House {liege.name}
                        </button>
                      ) : (
                        "Crown domain"
                      )}
                    </dd>
                    <dt>Resource</dt>
                    <dd>
                      {hex.resource} · {hex.port ? "Port" : "Landlocked"}
                      {hex.shipyard ? " / shipyard" : ""}
                    </dd>
                    {hex.seat && (
                      <>
                        <dt>House seat</dt>
                        <dd>
                          {hex.seat === "capital" ? "Capital" : "Secondary"} ·{" "}
                          {view.armies
                            .filter(
                              (a) =>
                                a.garrison &&
                                a.hex === hex.id &&
                                a.house === owner.id,
                            )
                            .reduce((n, a) => n + troopCount(a), 0)
                            .toLocaleString()}{" "}
                          troops
                        </dd>
                      </>
                    )}
                    {hex.city && (
                      <>
                        <dt>City</dt>
                        <dd>
                          {hex.city === "major" ? "Major city" : "Market city"}{" "}
                          · +12 trade cargo · {hex.city === "major" ? 4 : 2}{" "}
                          coins/turn
                        </dd>
                      </>
                    )}
                    {hex.castle && (
                      <>
                        <dt>Castle</dt>
                        <dd>
                          Level {hex.castle.level} · {castleGuard(view, hex)}{" "}
                          guards · +{Math.round(castleBonus(hex) * 100)}%
                          defense
                        </dd>
                      </>
                    )}
                    <dt>Loyalty</dt>
                    <dd>{owner.loyalty}/100</dd>
                    <dt>Unrest</dt>
                    <dd>{hex.unrest}/100</dd>
                    <dt>Obligation</dt>
                    <dd>{owner.obligation} contracted troops</dd>
                    <dt>Pledged</dt>
                    <dd>
                      {view.armies
                        .filter((a) => a.house === owner.id && a.pledgedTo)
                        .reduce((n, a) => n + troopCount(a), 0)}{" "}
                      troops
                    </dd>
                    <dt>Status</dt>
                    <dd>
                      {hex.occupation
                        ? `▨ Occupied by ${view.houses.find((h) => h.id === hex.occupation)?.name}`
                        : hex.disputed
                          ? "┄ Disputed claim"
                          : "Stable possession"}
                    </dd>
                  </dl>
                  <section
                    className="ed-hex-forces"
                    aria-label="Troops stationed on this hex"
                  >
                    {view.armies
                      .filter(
                        (a) =>
                          a.hex === hex.id &&
                          (troopCount(a) > 0 || woundedCount(a) > 0),
                      )
                      .map((a) => (
                        <div className="ed-profile-army" key={a.id}>
                          <strong>{a.name}</strong>
                          <small>
                            {troopCount(a).toLocaleString()} troops ·{" "}
                            {a.rebel
                              ? "Rebel"
                              : a.garrison
                                ? "Garrison"
                                : "Field army"}{" "}
                            · Morale {Math.round(a.morale)} · Loyalty{" "}
                            {Math.round(armyLoyalty(view, a))}% ·{" "}
                            {woundedCount(a)} wounded · Readiness{" "}
                            {armyHealth(a)}%
                          </small>
                          {canControl(view, actor, a) && !a.garrison && (
                            <button onClick={() => setArmy(a.id)}>
                              Select this army
                            </button>
                          )}
                        </div>
                      ))}
                  </section>
                  {attackNation && attackNation !== nation && (
                    <WarActions
                      state={view}
                      house={house}
                      nation={attackNation}
                      field={hex}
                      army={selectedArmy}
                      active={myTurn && !battle}
                      onCommand={execute}
                    />
                  )}
                  {fieldEnemy?.rebel && attackNation === nation && (
                    <button
                      disabled={
                        !myTurn ||
                        !!battle ||
                        !selectedArmy ||
                        selectedArmy.garrison ||
                        !canControl(view, actor, selectedArmy)
                      }
                      onClick={() =>
                        execute({ type: "attack", army, hex: hex.id })
                      }
                    >
                      Attack rebel forces
                    </button>
                  )}
                  {owner.id === house.id && (
                    <fieldset
                      className="ed-estate-actions ed-actions-fieldset"
                      disabled={!canAct || !!battle}
                    >
                      {hex.farm && (
                        <button
                          disabled={
                            !myTurn ||
                            !!battle ||
                            !!hex.occupation ||
                            (hex.harvestedAt !== undefined &&
                              view.tick - hex.harvestedAt < HARVEST_COOLDOWN)
                          }
                          onClick={() =>
                            execute({ type: "harvest", hex: hex.id })
                          }
                        >
                          <Leaf size={14} /> Harvest {harvestYield(hex)} food{" "}
                          {hex.harvestedAt !== undefined &&
                          view.tick - hex.harvestedAt < HARVEST_COOLDOWN
                            ? `· ready in ${HARVEST_COOLDOWN - (view.tick - hex.harvestedAt)} turns`
                            : ""}
                        </button>
                      )}
                      {hex.castle && hex.castle.level < 3 && (
                        <button
                          disabled={!!battle || !!hex.occupation}
                          onClick={() =>
                            execute({ type: "upgradeCastle", hex: hex.id })
                          }
                        >
                          <Shield size={14} /> Upgrade to level{" "}
                          {hex.castle.level + 1} ·{" "}
                          {hex.castle.level === 1 ? 150 : 300} coins · 30 timber
                          · 20 iron
                        </button>
                      )}
                      {view.armies
                        .filter(
                          (a) =>
                            a.garrison &&
                            a.hex === hex.id &&
                            a.house === house.id,
                        )
                        .map((g) => (
                          <div key={g.id}>
                            <button
                              disabled={
                                !!battle ||
                                !!hex.occupation ||
                                troopCount(g) < 1000
                              }
                              onClick={() =>
                                execute({
                                  type: "muster",
                                  army: g.id,
                                  count: 500,
                                })
                              }
                            >
                              <Swords size={14} /> Raise 500 troops · 50 coins ·
                              20 food
                            </button>
                            <button
                              disabled={!!battle || !!hex.occupation}
                              onClick={() =>
                                execute({
                                  type: "recruit",
                                  army: g.id,
                                  kind: "levies",
                                  count: 100,
                                })
                              }
                            >
                              Recruit 100 reserve troops · 100 coins · 50 food
                            </button>
                          </div>
                        ))}
                      <p className="ed-reason">
                        Seat troops include the 500 castle guards. Raising an
                        army transfers reserves and keeps the guards at home.
                        Field troops also need food and wages each turn.
                      </p>
                    </fieldset>
                  )}
                  {owner.reasons.map((r, i) => (
                    <p className="ed-reason" key={i}>
                      {r}
                    </p>
                  ))}
                  {hex.occupation && (
                    <button
                      disabled={!myTurn}
                      onClick={() => execute({ type: "annex", hex: hex.id })}
                    >
                      Annex estate · 50 coins / 3 turns of occupation
                    </button>
                  )}
                  {owner.liege === house.id && (
                    <button
                      disabled={!canAct || !!battle}
                      onClick={() =>
                        execute({ type: "summon", house: owner.id })
                      }
                    >
                      <Flag size={14} /> Summon this house
                    </button>
                  )}
                  {hex.owner === house.id && hex.port && !hex.shipyard && (
                    <button
                      disabled={!myTurn || !!battle}
                      onClick={() => execute({ type: "shipyard", hex: hex.id })}
                    >
                      Build shipyard · 100 coins / 30 timber
                    </button>
                  )}
                  {hex.bonus && (
                    <div className="ed-challenge-note">
                      <strong>
                        {hex.bonus === "gold"
                          ? "● Merchant’s table"
                          : "⚑ Tournament field"}
                      </strong>
                      <p>
                        {hex.bonus === "gold"
                          ? "A fair bargain earns 60 coins."
                          : "Read the battlefield and earn 20 levies."}{" "}
                        Three rewards per field; 30-turn cooldown.
                      </p>
                      <button
                        disabled={
                          !myTurn || hex.owner !== house.id || !!activeChallenge
                        }
                        onClick={() =>
                          execute({ type: "challenge", hex: hex.id })
                        }
                      >
                        Enter challenge
                      </button>
                      <small>
                        {view.rewards[`${house.id}|${hex.id}`] &&
                          `Claimed ${view.rewards[`${house.id}|${hex.id}`].count}/3 · next turn ${view.rewards[`${house.id}|${hex.id}`].next + 1}`}
                      </small>
                    </div>
                  )}
                </>
              ) : hex ? (
                <section>
                  <div className="ed-panel-title">
                    <span className="ed-eyebrow">SELECTED HEX · {hex.id}</span>
                    <h2>{hex.name}</h2>
                    <p>{BIOMES[hex.biome].description}</p>
                  </div>
                  <p>
                    {view.armies
                      .filter((a) => a.hex === hex.id)
                      .reduce((n, a) => n + troopCount(a), 0)}{" "}
                    troops · No house owns this sea field.
                  </p>
                  <p>
                    {view.routes.filter((r) => r.path.includes(hex.id)).length}{" "}
                    trade routes cross this field.
                  </p>
                </section>
              ) : (
                <div className="ed-panel-empty">
                  <Crown size={32} />
                  <h2>The realm awaits</h2>
                  <p>
                    Select a hex to inspect its estate, resources, loyalty, and
                    military obligations.
                  </p>
                </div>
              )}
            </div>
          )}
          {tab === "houses" && (
            <>
              <label>
                Navigate to a house
                <select
                  aria-label="Navigate to a house"
                  value={profileHouse.id}
                  onChange={(e) =>
                    visitHouse(
                      view.houses.find((h) => h.id === e.target.value)!,
                    )
                  }
                >
                  {NATIONS.map((n) => (
                    <optgroup key={n.id} label={n.name}>
                      {view.houses
                        .filter((h) => h.nation === n.id)
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            House {h.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="ed-house-directory" aria-label="Great houses">
                {view.titles.map((t) => {
                  const h = view.houses.find((h) => h.id === t.holder)!;
                  return (
                    <button
                      key={t.id}
                      className={profileHouse.id === h.id ? "active" : ""}
                      onClick={() => visitHouse(h)}
                    >
                      {h.crest} {h.name}
                    </button>
                  );
                })}
              </div>
              {profileHouse.id !== house.id && (
                <InsultAction
                  state={view}
                  house={house}
                  target={profileHouse}
                  active={myTurn && !battle}
                  onCommand={execute}
                />
              )}
              {profileHouse.nation !== nation && (
                <WarActions
                  state={view}
                  house={house}
                  nation={profileHouse.nation}
                  army={selectedArmy}
                  active={myTurn && !battle}
                  onCommand={execute}
                />
              )}
              <HouseProfile
                state={view}
                house={profileHouse}
                onHouse={visitHouse}
                onHex={(d) => {
                  select(d);
                  setMapCenter(center(d));
                  setMapZoom(1.8);
                  setRegion(true);
                }}
              />
            </>
          )}
          {tab === "council" && (
            <div className="ed-actions-fieldset">
              <div className="ed-panel-title">
                <span className="ed-eyebrow">THE FEUDAL COUNCIL</span>
                <h2>Oaths & ambitions</h2>
                <p>
                  Loyalty combines personal opinion and legitimacy. Contracts
                  set service obligations.
                </p>
              </div>
              {view.houses
                .filter((h) => h.nation === nation && h.id !== house.id)
                .map((v) => (
                  <div className="ed-vassal" key={v.id}>
                    <div>
                      <button
                        className="ed-house-link"
                        style={{ color: v.color }}
                        onClick={() => visitHouse(v)}
                      >
                        {v.crest} {v.name}
                      </button>
                      <b className={v.loyalty < 40 ? "ed-danger" : ""}>
                        {v.loyalty}%
                      </b>
                    </div>
                    <p>{v.ambition}</p>
                    <small>
                      Opinion {v.opinion} · Legitimacy {v.legitimacy} ·{" "}
                      {v.obligation} troops
                    </small>
                    <p className="ed-reason">
                      {v.rebellion
                        ? "⚑ REBELLION"
                        : v.loyalty < 40
                          ? "⚠ Likely refusal / pretender support"
                          : v.loyalty < 60
                            ? "⚠ Delays and reduced commitment"
                            : "Ready for campaign service"}{" "}
                      · {v.summons}
                    </p>
                    <div>
                      <button
                        disabled={!canAct || !!battle}
                        onClick={() => execute({ type: "summon", house: v.id })}
                      >
                        Summon
                      </button>
                      <button
                        disabled={!myTurn}
                        onClick={() =>
                          execute({ type: "concession", house: v.id })
                        }
                      >
                        Concession · 40
                      </button>
                      {v.role === "claimant" && (
                        <button
                          disabled={!myTurn}
                          onClick={() =>
                            execute({ type: "pretender", house: v.id })
                          }
                        >
                          Support claim · 80
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              <h3>Foreign crowns</h3>
              {NATIONS.filter((n) => n.id !== nation).map((n) => (
                <div className="ed-foreign" key={n.id}>
                  <button
                    className="ed-house-link"
                    onClick={() =>
                      visitHouse(
                        view.houses.find(
                          (h) =>
                            h.id ===
                            view.titles.find((t) => t.nation === n.id)!.holder,
                        )!,
                      )
                    }
                  >
                    {n.crest} {n.name}
                  </button>
                  <WarActions
                    state={view}
                    house={house}
                    nation={n.id}
                    army={selectedArmy}
                    active={myTurn && !battle}
                    onCommand={execute}
                  />
                  <button
                    disabled={!myTurn || !!battle}
                    onClick={() =>
                      execute({
                        type: "marry",
                        house: view.titles.find((t) => t.nation === n.id)!
                          .holder,
                      })
                    }
                  >
                    Propose marriage · 30 coins
                  </button>
                  <InsultAction
                    state={view}
                    house={house}
                    target={
                      view.houses.find(
                        (h) =>
                          h.id ===
                          view.titles.find((t) => t.nation === n.id)!.holder,
                      )!
                    }
                    active={myTurn && !battle}
                    onCommand={execute}
                  />
                </div>
              ))}
            </div>
          )}
          {tab === "dynasty" && (
            <fieldset
              className="ed-actions-fieldset"
              disabled={!canAct || !!battle}
            >
              <div className="ed-panel-title">
                <span className="ed-eyebrow">
                  HOUSE {house.name.toUpperCase()}
                </span>
                <h2>The line of succession</h2>
                <p>{NATIONS.find((n) => n.id === nation)!.succession}</p>
              </div>
              {house.family.map((p) => (
                <div className="ed-person" key={p.id}>
                  <CharacterPortrait person={p} house={house} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.gender} · {p.age} years ·{" "}
                      {!p.alive
                        ? "Deceased"
                        : p.id === house.ruler
                          ? "Ruling"
                          : heir(view, house)?.id === p.id
                            ? "Eligible heir"
                            : "Family"}
                    </small>
                    <small>
                      {p.parents.length
                        ? `Child of ${house.family.find((a) => a.id === p.parents[0])?.name}`
                        : "Dynasty founder"}
                    </small>
                    {p.spouse && (
                      <small>
                        Married to{" "}
                        {
                          view.houses
                            .flatMap((h) => h.family)
                            .find((a) => a.id === p.spouse)?.name
                        }
                      </small>
                    )}
                    {p.imprisonedBy && (
                      <small className="ed-danger">
                        Prisoner of {p.imprisonedBy}
                      </small>
                    )}
                    {p.claim && <small>Claim to the crown of {p.claim}</small>}
                  </div>
                </div>
              ))}
              <button onClick={() => execute({ type: "succession" })}>
                Pass the crown to the eligible heir
              </button>
              <h3>Titles held</h3>
              {view.titles
                .filter((t) => t.holder === house.id)
                .map((t) => (
                  <p key={t.id}>♛ Crown of {t.nation}</p>
                ))}
              <p className="ed-reason">
                Titles belong to houses, and can change hands after a claimant
                victory. Land ownership and troop origins remain distinct.
              </p>
            </fieldset>
          )}
          {tab === "economy" && (
            <fieldset
              className="ed-actions-fieldset"
              disabled={!canAct || !!battle}
            >
              <div className="ed-panel-title">
                <span className="ed-eyebrow">TREASURY & SUPPLY</span>
                <h2>The lifeblood of a realm</h2>
                <p>
                  Food sustains armies. Timber builds ships. Iron equips
                  soldiers. Ports connect distant estates.
                </p>
              </div>
              <div className="ed-ledger">
                {RESOURCES.map((r) => (
                  <div
                    key={r}
                    title={`Price bounded 1–12 coins; base × 1800 / max(900, total world stock). Current ${view.prices[r]} coins.`}
                  >
                    <span>{r}</span>
                    <b className={house.stock[r] < 15 ? "ed-danger" : ""}>
                      {Math.floor(house.stock[r])}
                    </b>
                    <small>{view.prices[r]} coins</small>
                  </div>
                ))}
              </div>
              <h3>Establish a route</h3>
              <p className="ed-reason">
                Select your origin estate on the map. Approved merchants move
                automatically, carrying 12 land or 24 maritime cargo.
              </p>
              <label>
                Cargo
                <select
                  value={resource}
                  onChange={(e) => setResource(e.target.value as Resource)}
                >
                  {RESOURCES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Destination
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Choose a market</option>
                  {view.districts
                    .filter(
                      (d) =>
                        d.owner && d.id !== selected && (!maritime || d.port),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ·{" "}
                        {view.houses.find((h) => h.id === d.owner)?.name}
                        {d.port ? " ⚓" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <label className="ed-checkbox">
                <input
                  type="checkbox"
                  checked={importCargo}
                  onChange={(e) => setImportCargo(e.target.checked)}
                />{" "}
                Import cargo into your estate
              </label>
              <label className="ed-checkbox">
                <input
                  type="checkbox"
                  checked={maritime}
                  onChange={(e) => setMaritime(e.target.checked)}
                />{" "}
                Maritime · shipyard required
              </label>
              <button
                disabled={
                  !myTurn || !hex || !destination || hex.owner !== house.id
                }
                onClick={() =>
                  execute({
                    type: "route",
                    from: selected!,
                    to: destination,
                    resource,
                    maritime,
                    import: importCargo,
                  })
                }
              >
                <Anchor size={14} /> Approve {maritime ? "ship" : "caravan"}{" "}
                route
              </button>
              <p className="ed-reason">
                Land setup 25 coins; ship 80 coins / 20 timber (Saltmere
                shipyard −15%). Transport costs 1 / 3 coins. Sea storm chance{" "}
                {view.config.maritimeHazard * 100}% per delivery; one foreign
                troop can stop trade. Blocking trade in peacetime gives the
                affected crown a justified war reason.
              </p>
              {view.routes
                .filter((r) => r.house === house.id)
                .map((r) => (
                  <div className="ed-route" key={r.id}>
                    <b>
                      {r.maritime ? "⚓" : "♘"} {r.resource} ·{" "}
                      {Math.floor(r.delivered)} delivered
                    </b>
                    <small>
                      {routeBlockers(view, r).length
                        ? `Blocked by ${routeBlockers(view, r)
                            .map((a) => a.name)
                            .join(", ")} · justification to declare war`
                        : r.status}
                    </small>
                  </div>
                ))}
              <h3>Food and armies</h3>
              <p className="ed-reason">
                Harvest your farmland in the District tab, or import grain
                through trade. City endpoints each add 12 cargo capacity. Raise
                a field host from a seat for 50 coins and 20 food per 500
                troops; recruit reserves to grow your force.
              </p>
              <h3>Reinforce selected troops</h3>
              <UnitGuide />
              {selectedArmy?.house === house.id ? (
                unitKinds.map((k) => (
                  <button
                    key={k}
                    onClick={() =>
                      execute({ type: "recruit", army, kind: k, count: 100 })
                    }
                  >
                    +100 {labels[k]} · {UNIT_STATS[k].cost * 100} coins · 50
                    food{k !== "levies" ? " · 50 iron" : ""}
                    {k === "cavalry" ? " · 50 horses" : ""}
                  </button>
                ))
              ) : (
                <p>Select your royal army to recruit at its estate.</p>
              )}
            </fieldset>
          )}
          <div className="ed-sidebar-tools">
            {online ? (
              <button onClick={() => connect("resume")}>Reconnect</button>
            ) : (
              <>
                <button onClick={save}>Save campaign</button>
                <button onClick={exportSave}>Export save</button>
              </>
            )}
          </div>
          {message && (
            <p className="ed-notice" role="alert">
              {message}
            </p>
          )}
        </aside>
      </div>
      <footer className="ed-journal">
        <span>
          CHRONICLE <span className="ed-dot">●</span>
        </span>
        <p>{message || view.log[0]}</p>
        <button onClick={() => setTab("council")}>
          Open council <ChevronRight size={14} />
        </button>
      </footer>
      <details className="ed-history">
        <summary>Campaign chronicle · {view.log.length} entries</summary>
        {view.log.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </details>
      {activeChallenge && (
        <div className="ed-modal-backdrop">
          <section className="ed-modal">
            <span className="ed-eyebrow">
              {activeChallenge.kind === "gold"
                ? "THE MERCHANT’S TABLE"
                : "THE SILVER TOURNAMENT"}
            </span>
            <h2>
              {activeChallenge.kind === "gold"
                ? "Strike a fair bargain"
                : "Command the field"}
            </h2>
            <p>{activeChallenge.question}</p>
            {activeChallenge.choices.map((c, i) => (
              <button
                key={i}
                onClick={() =>
                  execute({
                    type: "answer",
                    challenge: activeChallenge.id,
                    choice: i,
                  })
                }
              >
                {i + 1}. {c}
              </button>
            ))}
            <small>
              One attempt. Rewards and cooldowns are validated by the campaign
              authority.
            </small>
          </section>
        </div>
      )}
      {battle?.rounds && hiddenBattle !== battle.id && (
        <BattleRoundPanel
          key={`${battle.id}:${battle.rounds.round}`}
          state={view}
          battle={battle}
          house={house}
          onCommand={execute}
          onInspect={() => setHiddenBattle(battle.id)}
          message={message}
        />
      )}
      {!battle &&
        latestBattleReport &&
        dismissedBattleReport !== latestBattleReport.id && (
          <BattleOutcome
            report={latestBattleReport}
            onClose={() => setDismissedBattleReport(latestBattleReport.id)}
          />
        )}
      {battle && !battle.rounds && hiddenBattle !== battle.id && (
        <div className="ed-battle-backdrop">
          <section className="ed-battle-modal">
            <header>
              <div>
                <span className="ed-eyebrow">
                  ENCOUNTER {battle.id} · {view.battles.length} QUEUED
                </span>
                <h2>{view.districts.find((d) => d.id === battle.hex)!.name}</h2>
              </div>
              <span>
                Campaign frozen · {Math.floor(battle.seconds)}s{" "}
                <button onClick={() => setHiddenBattle(battle.id)}>
                  Inspect frozen campaign
                </button>
              </span>
            </header>
            <div className="ed-battle-content">
              <div className="ed-tactical-wrap">
                <svg
                  viewBox="0 0 100 100"
                  aria-label="Tactical formation battlefield"
                  onClick={(e) => {
                    const box = e.currentTarget.getBoundingClientRect();
                    const t: [number, number] = [
                      Math.max(
                        0,
                        Math.min(
                          100,
                          ((e.clientX - box.left) / box.width) * 100,
                        ),
                      ),
                      Math.max(
                        0,
                        Math.min(
                          100,
                          ((e.clientY - box.top) / box.height) * 100,
                        ),
                      ),
                    ];
                    setTarget(t);
                    if (formation)
                      execute({
                        type: "order",
                        battle: battle.id,
                        formation,
                        order,
                        x: t[0],
                        y: t[1],
                        facing,
                        width,
                      });
                  }}
                >
                  <rect
                    width="100"
                    height="100"
                    fill={BIOMES[field!.terrain].color}
                  />
                  <pattern
                    id="battle-grid"
                    width="10"
                    height="10"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M10 0H0V10"
                      fill="none"
                      stroke="#ffffff15"
                      strokeWidth=".2"
                    />
                  </pattern>
                  <rect width="100" height="100" fill="url(#battle-grid)" />
                  {field!.river && (
                    <rect
                      x="44"
                      width="12"
                      height="100"
                      fill="#63a4bd"
                      opacity=".8"
                    />
                  )}
                  {field!.road && (
                    <path d="M0 50H100" stroke="#d1bb89" strokeWidth="5" />
                  )}
                  {field!.obstacles.map((o, i) => (
                    <rect
                      key={i}
                      x={o.x}
                      y={o.y}
                      width={o.w}
                      height={o.h}
                      rx="3"
                      fill={field!.forest ? "#274733" : "#5c6260"}
                    />
                  ))}
                  <rect
                    x="74"
                    y="39"
                    width="8"
                    height="13"
                    fill="#9e916e"
                    stroke="#615541"
                  />
                  <text x="72" y="36" fontSize="2.5">
                    {field!.settlement}
                  </text>
                  {battle.formations
                    .filter((f) => f.count > 0 && !f.escaped)
                    .map((f) => {
                      const a = view.armies.find((a) => a.id === f.army)!;
                      return (
                        <g
                          key={f.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormation(f.id);
                          }}
                          transform={`translate(${f.x} ${f.y}) rotate(${f.facing})`}
                          opacity={f.routed ? 0.4 : 1}
                        >
                          <rect
                            x="-1.8"
                            y={-f.width / 4}
                            width="3.6"
                            height={f.width / 2}
                            fill={
                              canControl(view, actor, a) ? "#f3dc92" : "#bf5454"
                            }
                            stroke={formation === f.id ? "#fff" : "#292d23"}
                            strokeWidth=".6"
                          />
                          <path
                            d="M3 -1L5 0L3 1"
                            fill="none"
                            stroke="#fff"
                            strokeWidth=".5"
                          />
                          <text
                            x="-2"
                            y="0"
                            fontSize="2"
                            transform={`rotate(${-f.facing})`}
                          >
                            {Math.ceil(f.count)}
                          </text>
                          <title>
                            {labels[f.kind]} · morale {Math.floor(f.morale)} ·
                            fatigue {Math.floor(f.fatigue)} · {f.order}
                          </title>
                        </g>
                      );
                    })}
                  <circle
                    cx={target[0]}
                    cy={target[1]}
                    r="1"
                    fill="none"
                    stroke="#fff"
                    strokeWidth=".3"
                  />
                </svg>
                <p>
                  {field!.forest
                    ? "Woodland reduces archery visibility and movement."
                    : field!.river
                      ? "River crossing slows formations; road provides a ford."
                      : field!.hill
                        ? "High ground favours the defender."
                        : "Open ground favours cavalry."}{" "}
                  Reserves engage after 12s. Routed troops flee.
                </p>
              </div>
              <aside className="ed-battle-controls">
                {battle.armies.map((id) => {
                  const a = view.armies.find((a) => a.id === id)!;
                  return (
                    <div key={id}>
                      <h3>{a.name}</h3>
                      <p>
                        {canControl(view, actor, a)
                          ? "Authorized command"
                          : "AI commander / opposing player"}{" "}
                        · approach {battle.approaches[id]}
                      </p>
                      {battle.phase === "encounter" &&
                        canControl(view, actor, a) && (
                          <>
                            <button
                              onClick={() =>
                                execute({
                                  type: "stand",
                                  battle: battle.id,
                                  army: id,
                                })
                              }
                            >
                              Stand and fight
                            </button>
                            <button
                              onClick={() =>
                                execute({
                                  type: "retreat",
                                  battle: battle.id,
                                  army: id,
                                })
                              }
                            >
                              Attempt withdrawal
                            </button>
                          </>
                        )}
                    </div>
                  );
                })}
                {battle.phase === "combat" && (
                  <>
                    <label>
                      Formation
                      <select
                        value={formation}
                        onChange={(e) => setFormation(e.target.value)}
                      >
                        <option value="">Select formation</option>
                        {battle.formations
                          .filter((f) =>
                            canControl(
                              view,
                              actor,
                              view.armies.find((a) => a.id === f.army)!,
                            ),
                          )
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {labels[f.kind]} · {Math.ceil(f.count)} ·{" "}
                              {f.routed ? "Routed" : f.order}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="ed-orders">
                      {(
                        [
                          "move",
                          "face",
                          "hold",
                          "attack",
                          "charge",
                          "withdraw",
                        ] as OrderKind[]
                      ).map((o) => (
                        <button
                          key={o}
                          className={order === o ? "active" : ""}
                          onClick={() => setOrder(o)}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                    <label>
                      Facing · {facing}°
                      <input
                        type="range"
                        min="0"
                        max="359"
                        value={facing}
                        onChange={(e) => setFacing(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Width · {width}
                      <input
                        type="range"
                        min="4"
                        max="24"
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                      />
                    </label>
                    <button
                      disabled={!formation}
                      onClick={() =>
                        execute({
                          type: "order",
                          battle: battle.id,
                          formation,
                          order,
                          x: target[0],
                          y: target[1],
                          facing,
                          width,
                        })
                      }
                    >
                      Issue order at selected point
                    </button>
                    <p className="ed-reason">
                      Select a formation and an order, then click the field.
                      Hold restores fatigue; charges tire quickly. Face
                      vulnerable flanks toward the enemy.
                    </p>
                    <button
                      onClick={() =>
                        execute({
                          type: "battlePause",
                          battle: battle.id,
                          approve: !battle.pauseVotes.includes(house.id),
                        })
                      }
                    >
                      {battle.pauseVotes.includes(house.id)
                        ? "Resume vote"
                        : "Request tactical pause"}
                    </button>
                    <small>
                      {battle.pauseVotes.length} pause votes ·{" "}
                      {online
                        ? "Unanimous participants required"
                        : "Single-player tactical pause"}
                    </small>
                  </>
                )}
                {message && <p className="ed-notice">{message}</p>}
              </aside>
            </div>
          </section>
        </div>
      )}
    </main>,
    document.body,
  );
}
