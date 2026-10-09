import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import {
  CouncilConnection,
  councilAction,
  savedCouncil,
} from "../../../games/MedievalKingdoms/edravane/network.ts";
import type {
  CouncilView,
  CouncilRequest,
} from "../../../games/MedievalKingdoms/edravane/multiplayer.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  activeTurnHouse,
  defendingArmies,
} from "../../../games/MedievalKingdoms/edravane/turns.ts";
import { HexFields } from "./HexFields.tsx";
import { EstateLabels } from "./EstateLabel.tsx";
import { clampMapZoom, MAX_MAP_ZOOM, MIN_MAP_ZOOM, mapViewport } from "./mapViewport.ts";
import { HouseProfile } from "./HouseProfile";
import { CharacterPortrait } from "./CharacterPortrait.tsx";
import { WarActions } from "./WarActions";
import { InsultAction } from "./InsultAction.tsx";
import { RealmIcon } from "./RealmIcon.tsx";
import { armyControl, CONTROL_LABELS, territoryControl } from "./mapPresentation.ts";
import { mapBounds, territoryLayouts } from "./territoryLayout.ts";
import { HouseSigil } from "./HouseSigil.tsx";
import { ArmyLogistics, Chronicle, DistrictStrategy, KingdomIdentity, MarriagePlanner, Personality, SuccessionPlanner, VassalBargain } from "./RealmPanels.tsx";
import { IDENTITIES, ruler, season, successionPreview } from "../../../games/MedievalKingdoms/edravane/realm.ts";
import { peaceDescription } from "../../../games/MedievalKingdoms/edravane/campaignStrategy.ts";
import { strategyView } from "../../../games/MedievalKingdoms/edravane/logistics.ts";
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
  useGameLanguage();
  const [state, setState] = useState<Campaign | null>(null),
    [nation, setNation] = useState("auremarch"),
    [selection, setSelected] = useState<string | null>(null),
    [selectedHouse, setSelectedHouse] = useState<string | null>(null),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [panelExpanded, setPanelExpanded] = useState(false),
    [panelSide, setPanelSide] = useState<"east" | "west">("east"),
    [mapFrame, setMapFrame] = useState({ width: 1440, height: 900 }),
    [inspectedReaction, setInspectedReaction] = useState(""),
    [region, setRegion] = useState(false),
    [mapZoom, setMapZoom] = useState(MIN_MAP_ZOOM),
    [mapPanning, setMapPanning] = useState(false),
    [cameraCenter, setMapCenter] = useState<[number, number] | null>(null),
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
  const cameraFrame = useRef<number | null>(null);
  const pendingCamera = useRef<[number, number] | null>(null);
  const mapZoomRef = useRef(MIN_MAP_ZOOM);
  useEffect(() => { mapZoomRef.current = mapZoom; }, [mapZoom]);
  const zoomMap = useCallback((requested: number) => {
    const zoom = clampMapZoom(requested);
    mapZoomRef.current = zoom;
    setMapZoom(zoom);
    if (zoom === MIN_MAP_ZOOM) {
      if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
      cameraFrame.current = null;
      pendingCamera.current = null;
      mapDrag.current = null;
      setMapPanning(false);
      setMapCenter(null);
      setRegion(false);
    }
  }, []);
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
  const view = useMemo(() => state ? online ? state : strategyView(state, `${nation}-0`) : createCampaign(nation), [state, online, nation]);
  const worldBounds = useMemo(() => mapBounds(view.districts), [view.districts]);
  const playableBounds = useMemo(() => mapBounds(view.districts, { includeLegacy: false }), [view.districts]);
  const realmTerritories = useMemo(() => territoryLayouts(view, "realm"), [view]);
  const houseTerritories = useMemo(() => territoryLayouts(view, "house"), [view]);
  const mapCenter = cameraCenter ?? (campaignStarted ? playableBounds.center : worldBounds.center);
  const house = view.houses.find((h) => h.id === `${nation}-0`)!;
  const actor = { house: house.id };
  const requestedArmy = view.armies.find((a) => a.id === armySelection);
  const army = requestedArmy?.garrison
    ? (view.armies.find(
        (a) => a.house === requestedArmy.house && !a.garrison && !a.pledgedTo && !a.rebel,
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
  const selectedSiege = view.sieges?.find((siege) => siege.army === army);
  const control = selectedArmy ? armyControl(view, house, selectedArmy) : undefined;
  const armyOwner = view.houses.find((h) => h.id === selectedArmy?.house);
  const panelVisible = sidebarOpen || !!(myResponse && inspectedReaction !== activeReaction?.id);
  const crownHolder = view.houses.find((h) => h.id === view.titles.find((t) => t.nation === house.nation)?.holder);
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
    const observer = new ResizeObserver(([entry]) => setMapFrame({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(svg.parentElement ?? svg);
    let zoomFrame: number | null = null;
    let zoomFactor = 1;
    let zoomIdle: ReturnType<typeof setTimeout> | undefined;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomFactor *= event.deltaY > 0 ? 0.88 : 1.12;
      svg.classList.add("ed-camera-zooming");
      if (zoomFrame === null) zoomFrame = requestAnimationFrame(() => {
        const factor = zoomFactor;
        zoomFrame = null;
        zoomFactor = 1;
        zoomMap(mapZoomRef.current * factor);
      });
      clearTimeout(zoomIdle);
      zoomIdle = setTimeout(() => svg.classList.remove("ed-camera-zooming"), 160);
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", wheel);
      observer.disconnect();
      if (zoomFrame !== null) cancelAnimationFrame(zoomFrame);
      clearTimeout(zoomIdle);
      svg.classList.remove("ed-camera-zooming");
    };
  }, [campaignStarted, zoomMap]);
  function resetCamera() {
    zoomMap(MIN_MAP_ZOOM);
  }
  function panMap(dx: number, dy: number) {
    setMapPanning(false);
    setMapCenter((current) => {
      const [x, y] = current ?? playableBounds.center;
      return [
        Math.max(worldBounds.minX, Math.min(worldBounds.maxX, x + (dx * 90) / mapZoom)),
        Math.max(worldBounds.minY, Math.min(worldBounds.maxY, y + (dy * 90) / mapZoom)),
      ];
    });
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
      if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
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
  const select = useCallback((d: District) => {
    setSelected(d.id);
    setInspectedReaction(activeReaction?.id ?? "");
    setSidebarOpen(true);
    setTab("district");
    if (campaignStarted) {
      setMapCenter(center(d));
      setMapZoom(1.8);
      setRegion(true);
    }
  }, [activeReaction?.id, campaignStarted]);
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
    const bounds = mini || !campaignStarted ? worldBounds : playableBounds;
    const zoom = mini ? 1 : mapZoom;
    const regional = !mini && zoom >= 1.6;
    const detailed = !mini && zoom >= 2.6;
    const c = mini || !campaignStarted ? worldBounds.center : mapCenter;
    const mobile = mapFrame.width <= 700;
    const frame = mini || !campaignStarted ? { width: worldBounds.width, height: worldBounds.height } : mapFrame;
    // Fit playable fields between the floating interface; the locked legacy entry doesn't shrink the world.
    const left = mobile ? 12 : panelSide === "west" ? panelVisible ? 374 : 30 : 230;
    const right = mobile ? 12 : panelSide === "east" ? panelVisible ? 374 : 30 : 230;
    const top = mobile ? 375 : 185;
    const hasOrders = !!selectedArmy && (!selectedArmy.garrison || control === "vassal");
    const bottom = mobile ? (panelVisible ? mapFrame.height * .34 + 30 : 35) + (hasOrders ? 105 : 0) : hasOrders ? 245 : 70;
    const scale = mini || !campaignStarted ? zoom : Math.max(.08, Math.min((frame.width - left - right) / bounds.width, (frame.height - top - bottom) / bounds.height)) * zoom;
    const origin = mini || !campaignStarted ? [frame.width / 2, frame.height / 2] : [(left + frame.width - right) / 2, (top + frame.height - bottom) / 2];
    const viewport = mini || !campaignStarted ? "" : mapViewport(c, origin, scale, frame);
    return (
      <svg
        ref={mini ? undefined : mapElement}
        onPointerDown={
          mini
            ? undefined
            : (e) => {
                if (!campaignStarted || e.button !== 0) return;
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
                pendingCamera.current = [
                  Math.max(worldBounds.minX, Math.min(worldBounds.maxX, drag.center[0] - dx / scale)),
                  Math.max(worldBounds.minY, Math.min(worldBounds.maxY, drag.center[1] - dy / scale)),
                ];
                if (cameraFrame.current === null) cameraFrame.current = requestAnimationFrame(() => {
                  cameraFrame.current = null;
                  if (pendingCamera.current) setMapCenter(pendingCamera.current);
                  pendingCamera.current = null;
                });
              }
        }
        onPointerUp={
          mini
            ? undefined
            : (e) => {
                if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
                cameraFrame.current = null;
                if (pendingCamera.current) setMapCenter(pendingCamera.current);
                pendingCamera.current = null;
                setMapPanning(false);
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }
        }
        onPointerCancel={
          mini
            ? undefined
            : () => {
                if (cameraFrame.current !== null) cancelAnimationFrame(cameraFrame.current);
                cameraFrame.current = null;
                pendingCamera.current = null;
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
        className={mini ? "ed-minimap" : `ed-world-svg${mapPanning ? " ed-camera-moving" : ""}`}
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        role={mini ? "img" : "group"}
        aria-label={gameUi(mini ? "World minimap" : "Interactive hex map of Edravane")}
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
        <rect width={frame.width} height={frame.height} fill="#193942" />
        <rect
          width={frame.width}
          height={frame.height}
          fill={`url(#${mini ? "mini-water" : "water"})`}
        />
        <g
          style={{
            transform: `translate(${origin[0] - c[0] * scale}px, ${origin[1] - c[1] * scale}px) scale(${scale})`,
            transition: mapPanning
              ? "none"
              : reduced
                ? "none"
                : "transform 180ms ease-out",
          }}
        >
          <HexFields view={view} house={house} overlay={mini ? "ownership" : overlay} regional={regional} detailed={detailed} mini={mini} viewport={viewport} supplyArmy={overlay === "supply" ? selectedArmy ?? view.armies.find((a) => a.house === house.id) : undefined} onSelect={select} />
          {!mini && detailed && <EstateLabels view={view} viewport={viewport} resolution={Math.max(1, Math.min(4, Math.ceil(scale * window.devicePixelRatio)))} />}
          {gameUi(!mini &&
            view.routes.filter((r) => overlay === "trade" || detailed && r.house === house.id).map((r) => {
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
            }))}
          {gameUi(!mini && !regional && realmTerritories.map((territory) => {
            const pathId = `realm-name-${territory.id}`;
            return <g key={pathId} className="ed-realm-map-label" transform={`translate(${territory.x} ${territory.y - 27}) rotate(${territory.angle})`} pointerEvents="none" aria-hidden="true" data-territory={territory.id} data-fields={territory.districts.length}>
              <path id={pathId} d={`M${-territory.width / 2} 0 Q0 ${-territory.width * .09} ${territory.width / 2} 0`} fill="none" />
              <text fontFamily="Georgia" fontSize={territory.fontSize} fontWeight="bold" letterSpacing="1.4" fill="#fff1cb" stroke="#172e28" strokeWidth="3" paintOrder="stroke"><textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{gameUi(territory.title.toUpperCase())}</textPath></text>
            </g>;
          }))}
          {gameUi(!mini && houseTerritories.map((territory) => {
            const size = territory.house.role === "crown" ? 28 : regional ? 24 : 18;
            const pathId = `house-name-${territory.id}`;
            return <g key={pathId} className="ed-house-map-label" pointerEvents="none" aria-hidden="true" data-house={territory.house.id} data-fields={territory.districts.length}>
              <g transform={`translate(${territory.x - size / 2} ${territory.y - size * .6})`}><HouseSigil house={territory.house} size={size} /></g>
              {regional && <g transform={`translate(${territory.x} ${territory.y - size * .6 - 9}) rotate(${territory.angle})`}>
                <path id={pathId} d={`M${-territory.width / 2} 0 Q0 ${-territory.width * .07} ${territory.width / 2} 0`} fill="none" />
                <text fontFamily="Georgia" fontSize={territory.fontSize} letterSpacing=".6" fill="#fff0ca" stroke="#18362b" strokeWidth="2" paintOrder="stroke"><textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{gameUi(territory.title.toUpperCase())}</textPath></text>
              </g>}
              {gameUi(regional && territory.components.slice(1).filter((component) => component.length >= 2).map((component) => { const [x, y] = center(component[0]); return <g key={component[0].id} transform={`translate(${x - 7} ${y - 8})`} opacity=".75"><HouseSigil house={territory.house} size={14} /></g>; }))}
            </g>;
          }))}
          {gameUi(!mini &&
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
                const command = armyControl(view, house, a);
                const marker = command === "own" || command === "pledged" || command === "awaiting" ? "#f6d97b" : command === "vassal" ? "#d5be83" : command === "hostile" ? "#ef9990" : "#bdcacc";
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
                    aria-label={gameUi(`${a.name}, ${CONTROL_LABELS[command]}`)}
                    data-control={command}
                  >
                    {a.id === army && <rect x={x - 21 + (i % 2) * 8} y={y - 2} width="24" height="24" rx="4" fill="#b9e0e91a" stroke="#b9e0e9" strokeWidth=".8" />}
                    {(command === "pledged" || command === "awaiting") && <circle cx={x - 9 + (i % 2) * 8} cy={y + 10} r="9.5" fill="none" stroke={marker} strokeWidth=".8" strokeDasharray={command === "awaiting" ? "3 2" : undefined} />}
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
                      stroke={marker}
                      strokeWidth="1.8"
                      strokeDasharray={command === "vassal" ? "1 2.5" : undefined}
                      strokeLinecap="round"
                    />
                    <g transform={`translate(${x - 15 + (i % 2) * 8},${y + 4})`} style={{ color: marker }} pointerEvents="none"><RealmIcon metric="troops" size={12} /></g>
                    {regional && <text x={x} y={y + 27} textAnchor="middle" fontSize="7" fill="#fff1cb" stroke="#142c22" strokeWidth="2" paintOrder="stroke">{gameUi(troopCount(a).toLocaleString())}</text>}
                    <title>
                      {gameUi(a.name)}: {gameUi(troopCount(a))}{gameUi(" troops · ")}{gameUi(CONTROL_LABELS[command])}
                    </title>
                  </g>
                );
              }))}
          {gameUi(!mini && (view.intelligence?.[house.id] ?? []).filter((r) => !view.armies.some((a) => a.id === r.army)).map((report) => {
            const d = view.districts.find((d) => d.id === report.hex)!;
            const [x, y] = center(d);
            return <g key={report.army} className="ed-intel-marker" role="button" tabIndex={0} aria-label={gameUi(`${report.name}: last reported ${report.low}–${report.high} troops, round ${report.seen}`)} onClick={() => select(d)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(d); } }}><circle cx={x} cy={y + 10} r="8" fill="#253c3c" stroke="#d6c6a4" strokeDasharray="2 2" /><text x={x} y={y + 13} fill="#e4d9bb" textAnchor="middle" fontSize="10">?</text><title>{gameUi(report.name)}: {gameUi(report.low)}–{gameUi(report.high)}{gameUi(" troops · last seen round ")}{gameUi(report.seen)}</title></g>;
          }))}
          {gameUi(!mini && selected && hex && (
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
          ))}
        </g>
        {gameUi(!mini && (
          <>
            <text
              x="38"
              y={frame.height - 34}
              fontFamily="Georgia"
              fontSize="13"
              fill="#abc4c2"
              letterSpacing="4"
            >{gameUi(" THE AZURE SEA ")}</text>
            <g transform={`translate(${frame.width - 54} ${frame.height - 65})`} fill="none" stroke="#cfc39b">
              <path d="M0 -22 L5 0 L0 22 L-5 0Z M-22 0H22" />
              <text x="-4" y="-28" fill="#cfc39b" stroke="none" fontSize="10">
                N
              </text>
            </g>
          </>
        ))}
      </svg>
    );
  }
  if (!state)
    return (
      <main className="ed-app ed-start">
        <header className="ed-masthead">
          <Link to="/games">
            <ArrowLeft size={16} />{gameUi(" Games ")}</Link>
          <span>{gameUi(" MEDIEVAL KINGDOMS ")}<b> / </b>{gameUi(" A NEW CHRONICLE ")}</span>
          <Link to="/games/medieval-kingdoms/legacy">{gameUi(" Legacy mode ")}<ArrowUpRight size={15} />
          </Link>
        </header>
        <div className="ed-intro">
          <div>
            <span className="ed-eyebrow">{gameUi("EIGHT CROWNS. TWO CONTINENTS.")}</span>
            <h1>{gameUi(" Edravane ")}<span>{gameUi(" A kingdom is inherited. ")}<br />{gameUi(" An empire is earned. ")}</span>
            </h1>
            <p>{gameUi(" Raise your dynasty, call your banners, and shape the fortunes of a living world. ")}</p>
          </div>
          <div className="ed-intro-map">{gameUi(map())}</div>
        </div>
        <section className="ed-selection">
          <div className="ed-section-title">
            <h2>{gameUi("Choose your crown")}</h2>
            <span>{gameUi("01 — Found a dynasty")}</span>
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
                <span className="ed-crest ed-sigil-frame"><HouseSigil house={view.houses.find((h) => h.id === `${n.id}-0`)!} size={36} /></span>
                <div>
                  <strong>{gameUi(n.name)}</strong>
                  <small>{gameUi("HOUSE ")}{gameUi(n.house.toUpperCase())}</small>
                  <span>
                    {gameUi(n.people)} · {gameUi(n.succession)}
                  </span>
                  <small>{gameUi(IDENTITIES[n.id].title)}</small>
                </div>
                {nation === n.id && <Crown size={16} />}
              </button>
            ))}
          </div>
          <div className="ed-start-actions">
            <button className="ed-primary" onClick={start}>
              <Crown size={16} />{gameUi(" Begin single-player ")}<ArrowUpRight size={16} />
            </button>
            <button
              aria-expanded={networkMenu}
              aria-controls="ed-network-lobby"
              onClick={() => setNetworkMenu((v) => !v)}
            >
              <Flag size={16} />{gameUi(" Multiplayer council ")}</button>
            <button onClick={resume}>{gameUi("Continue saved campaign")}</button>
            <button onClick={() => file.current?.click()}>{gameUi("Import save")}</button>
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
              aria-label={gameUi("Multiplayer lobby")}
            >
              <h3>{gameUi("Gather the eight banners")}</h3>
              <p>{gameUi(" Multiplayer uses your existing Supabase account.")}{gameUi(" ")}
                <Link to="/login">{gameUi("Log in")}</Link>{gameUi(" to host or join; councils and turns are saved automatically. ")}</p>
              {!lobby && (
                <>
                  <p>{gameUi(" Each crown takes a turn. Use End turn to commit movement and pass control. War, invasion, peace and marriage proposals allow the receiving player to respond. Unoccupied slots are bots. During battles, campaign turns wait for the outcome; both sides commit an order before each round resolves. Production, movement, trade, and challenge cooldowns stay frozen. ")}</p>
                  <div className="ed-form-row">
                    <label>{gameUi(" Your name ")}<input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label>{gameUi(" Room code ")}<input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="ed-form-row">
                    <button onClick={() => connect("create")}>{gameUi(" Host council ")}</button>
                    <button onClick={() => connect("join")}>{gameUi(" Join council ")}</button>
                    <button
                      className="ed-reconnect"
                      onClick={() => connect("resume")}
                    >{gameUi(" Reconnect ")}</button>
                    <span>{gameUi(netStatus)}</span>
                  </div>
                </>
              )}
              {lobby && (
                <>
                  <p>{gameUi(" Room ")}<strong>{lobby.code}</strong>{gameUi(" · share this code with the other players. ")}</p>
                  <div
                    className="ed-form-row ed-lobby-actions"
                    role="group"
                    aria-label={gameUi("Your lobby controls")}
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
                      {gameUi(lobbyReady ? "Cancel ready" : "Ready")}
                    </button>
                    {gameUi(lobby.host === player && (
                      <>
                        <label>{gameUi(" Sea hazard ")}<select
                            value={lobby.settings.maritimeHazard}
                            onChange={(e) =>
                              netSend({
                                type: "settings",
                                tickSeconds: lobby.settings.tickSeconds,
                                maritimeHazard: Number(e.target.value),
                              })
                            }
                          >
                            <option value="0">{gameUi("Calm")}</option>
                            <option value="0.025">{gameUi("Normal · 2.5%")}</option>
                            <option value="0.08">{gameUi("Harsh · 8%")}</option>
                          </select>
                        </label>
                        <button
                          className="ed-primary"
                          disabled={
                            !allPlayersReady || netStatus !== "Connected"
                          }
                          onClick={() => netSend({ type: "start" })}
                        >{gameUi(" Start campaign ")}</button>
                      </>
                    ))}
                  </div>
                  <p className="ed-lobby-status" role="status">
                    {gameUi(lobbyReady
                      ? "You are ready."
                      : "Click Ready when you have chosen your crown.")}{gameUi(" ")}
                    {gameUi(allPlayersReady
                      ? lobby.host === player
                        ? "All players are ready. You can start the campaign."
                        : "All players are ready. Waiting for the host to start."
                      : "Waiting for every player, including the host, to be ready.")}
                  </p>
                  {gameUi(netStatus !== "Connected" && (
                    <div className="ed-form-row">
                      <span role="status">{gameUi(netStatus)}</span>
                      <button onClick={() => connect("resume")}>{gameUi(" Reconnect ")}</button>
                    </div>
                  ))}
                  <div className="ed-slots">
                    {lobby.slots.map((s) => (
                      <div
                        key={s.nation}
                        className={s.player === player ? "ed-slot-self" : ""}
                      >
                        <b>{gameUi(NATIONS.find((n) => n.id === s.nation)!.name)}</b>
                        <span>
                          {gameUi(s.bot ? "Bot" : s.name)}
                          {gameUi(s.player === player ? " (you)" : "")}
                          {gameUi(s.player === lobby.host ? " · Host" : "")} ·{gameUi(" ")}
                          {gameUi(s.ready ? "Ready" : "Not ready")}
                          {gameUi(s.player && !s.connected ? " · disconnected" : "")}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
          {gameUi(message && (
            <p className="ed-notice" role="status">
              {gameUi(message)}
            </p>
          ))}
          <p className="ed-footnote">{gameUi(" Two continents · ")}{gameUi(view.districts.length)}{gameUi(" hexes · ")}{gameUi(view.districts.filter((d) => d.nation).length)}{gameUi(" land districts · 40 great and minor houses · Legacy progress preserved ")}</p>
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
      className={`ed-app ed-playing ed-panel-${panelSide} ${panelVisible ? "" : "ed-sidebar-hidden"}`}
    >
      <header className="ed-masthead">
        <Link to="/games">
          <ArrowLeft size={16} />{gameUi(" Games ")}</Link>
        <span>{gameUi(" MEDIEVAL KINGDOMS ")}<b>/</b>{gameUi(" EDRAVANE ")}</span>
        <Link to="/games/medieval-kingdoms/legacy">{gameUi(" Legacy mode ")}<ArrowUpRight size={15} />
        </Link>
      </header>
      <div className="ed-topbar">
        <div
          className="ed-dynasty-mark"
          style={{ borderColor: NATIONS.find((n) => n.id === nation)!.color }}
        >
          <Crown />
          <div>
            <h1>{gameUi(NATIONS.find((n) => n.id === nation)!.name)}</h1>
            <span>{gameUi(" HOUSE ")}{gameUi(house.name.toUpperCase())} ·{gameUi(" ")}
              {house.family.find((p) => p.id === house.ruler)?.name}
            </span>
          </div>
        </div>
        <div className="ed-stat">
          <small>{gameUi("COINS")}</small>
          <b>
            <Coins size={15} /> {gameUi(money(house.treasury))}
          </b>
        </div>
        <div className="ed-stat ed-food-stat">
          <small>{gameUi("FOOD")}</small>
          <b>
            <Leaf size={15} /> {gameUi(money(house.stock.grain))}
          </b>
        </div>
        <div className="ed-stat">
          <small>{gameUi("HOUSE TROOPS")}</small>
          <b>
            <Swords size={15} />{gameUi(" ")}
            {gameUi(myArmies
              .filter((a) => canControl(view, actor, a))
              .reduce((n, a) => n + troopCount(a), 0))}
          </b>
        </div>
        <div className="ed-stat">
          <small>{gameUi("ROUND / TURN")}</small>
          <b>
            {gameUi(view.turns?.round ?? 1)} · {gameUi(actingHouse?.name ?? "Council")}
          </b>
          <small>{gameUi(season(view))} · {gameUi(mapZoom < 1.6 ? "World view" : mapZoom < 2.6 ? "Regional view" : "Estate view")}</small>
        </div>
        <div className="ed-tools">
          <button
            className="ed-end-turn"
            disabled={!myTurn || !!battle}
            onClick={() => execute({ type: "endTurn" })}
          >{gameUi(" End turn ")}<ChevronRight size={16} />
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
          >{gameUi(" Campaign menu ")}</button>
          {online ? (
            <>
              <span className="ed-live">{gameUi("Room ")}{code}</span>
              <span className="ed-live">● {gameUi(netStatus)}</span>
              <button onClick={() => connect("resume")}>{gameUi("Reconnect")}</button>
            </>
          ) : (
            <>
              <button className="ed-save" onClick={save}>
                <Save size={16} />{gameUi(" Save ")}</button>
              <button className="ed-export" onClick={exportSave}>{gameUi(" Export ")}</button>
            </>
          )}
        </div>
      </div>
      <div className="ed-turn-status" role="status">
        {gameUi(activeReaction && !battle
          ? `${myResponse ? "Your response required" : "Awaiting response"}: ${view.houses.find((h) => h.id === activeReaction.from)?.name} → ${view.houses.find((h) => h.id === activeReaction.to)?.name} · ${activeReaction.kind}`
          : battle
            ? hiddenBattle === battle.id
              ? "Battle in progress · campaign waits"
              : "Battle in progress · campaign turns wait for the outcome"
            : crownHolder?.id !== house.id
              ? `Your crown has passed to House ${crownHolder?.name}. Review the chronicle or start a new campaign from Campaign menu.`
            : myTurn
              ? "Your turn · plan diplomacy, harvest, raise troops and order movement, then End turn."
              : `${actingHouse?.name ?? "The council"} is taking its turn. You can inspect the map while waiting.`)}
        {gameUi(battle && hiddenBattle === battle.id && (
          <button
            className="ed-battle-return"
            onClick={() => setHiddenBattle("")}
          >{gameUi(" Return to battle ")}</button>
        ))}
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
                <ZoomOut size={14} />{gameUi(" World ")}</button>
              {gameUi(region && hex && (
                <>
                  <ChevronRight size={14} />
                  <span>{gameUi(NATIONS.find((n) => n.id === hex.nation)?.name)}</span>
                  <ChevronRight size={14} />
                  <span>{gameUi(hex.settlement)}</span>
                </>
              ))}
            </div>
            <span>{gameUi("THE REALMS OF EDRAVANE")}</span>
          </div>
          <div className="ed-map">
            {gameUi(map())}
            <div
              className="ed-zoom-controls"
              role="group"
              aria-label={gameUi("Map zoom controls")}
            >
              <button
                aria-label={gameUi("Zoom out map")}
                disabled={mapZoom <= MIN_MAP_ZOOM}
                onClick={() => zoomMap(mapZoom - 0.25)}
              >
                <Minus size={15} />
              </button>
              <span>{gameUi(Math.round(mapZoom * 100))}%</span>
              <button
                aria-label={gameUi("Zoom in map")}
                disabled={mapZoom >= MAX_MAP_ZOOM}
                onClick={() => zoomMap(mapZoom + 0.25)}
              >
                <Plus size={15} />
              </button>
              <button onClick={resetCamera}>{gameUi("Fit map")}</button>
            </div>
            <div
              className="ed-pan-controls"
              role="group"
              aria-label={gameUi("Map direction controls")}
              onKeyDown={mapKey}
            >
              <button
                aria-label={gameUi("View map west")}
                title={gameUi("View west · Left arrow")}
                disabled={mapCenter[0] <= worldBounds.minX}
                onClick={() => panMap(-1, 0)}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                aria-label={gameUi("View map north")}
                title={gameUi("View north · Up arrow")}
                disabled={mapCenter[1] <= worldBounds.minY}
                onClick={() => panMap(0, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                aria-label={gameUi("View map south")}
                title={gameUi("View south · Down arrow")}
                disabled={mapCenter[1] >= worldBounds.maxY}
                onClick={() => panMap(0, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                aria-label={gameUi("View map east")}
                title={gameUi("View east · Right arrow")}
                disabled={mapCenter[0] >= worldBounds.maxX}
                onClick={() => panMap(1, 0)}
              >
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="ed-overlay-controls">
              {["terrain", "ownership", "loyalty", "resources", "trade", "supply", "diplomacy", "claims"].map(
                (o) => (
                  <button
                    className={overlay === o ? "active" : ""}
                    key={o}
                    onClick={() => setOverlay(o)}
                  >
                    {gameUi(o === "ownership" ? (
                      <Shield size={13} />
                    ) : o === "trade" ? (
                      <Anchor size={13} />
                    ) : o === "resources" ? (
                      <Leaf size={13} />
                    ) : (
                      <Flag size={13} />
                    ))}{gameUi(" ")}
                    {gameUi(o)}
                  </button>
                ),
              )}
            </div>
            <div className="ed-map-mode-guide" role="status">{gameUi(overlay === "supply" ? "Green: an open supply route · red: carried food needed" : overlay === "diplomacy" ? "Gold: your realm · blue: marriage allies · red: enemies" : overlay === "claims" ? "Gold: your realm · purple: inherited family claims" : overlay === "loyalty" ? "Green: ready for service · amber: reduced commitment · red: refusal risk" : overlay === "trade" ? "Dashed lines: trade routes · ports and blockades control access" : "House sigils mark controlled fields · zoom for house names and estates")}</div>
            <div className="ed-control-legend" aria-label={gameUi("Map control legend")}><span><i className="ed-line-direct" />{gameUi("Your domain")}</span><span><i className="ed-line-vassal" />{gameUi("Vassal estates")}</span><small>{gameUi("Solid hosts: direct orders · dotted hosts: requests · double ring: pledged service")}</small></div>
            <button
              className="ed-sidebar-toggle"
              onClick={() => {
                setSidebarOpen((v) => !v);
                setInspectedReaction(activeReaction?.id ?? "");
              }}
            >
              {gameUi(sidebarOpen ||
              (myResponse && inspectedReaction !== activeReaction?.id)
                ? "Hide sidebar"
                : "Show sidebar")}
            </button>
            <div className="ed-map-bottom">
              <div>
                <span>
                  <i className="gold" />{gameUi(" Your estate · ♛ ")}</span>
                <span>
                  <i className="green" />{gameUi(" Vassal crest ")}</span>
                <span>{gameUi("♜ Castle · 500 guards")}</span>
                <span>{gameUi("⌂ City · trade")}</span>
                <span>{gameUi("▨ Occupied")}</span>
                <span>{gameUi("┄ Disputed")}</span>
                <span>{gameUi("Wheel to zoom · drag or arrows to explore")}</span>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => setReduced(e.target.checked)}
                />{gameUi(" ")}{gameUi(" Reduce motion ")}</label>
            </div>
            {gameUi(region && (
              <button className="ed-return" onClick={resetCamera}>
                <ArrowLeft size={14} />{gameUi(" Return to world ")}</button>
            ))}
          </div>
          <div className={`ed-army-bar ${selectedArmy && (!selectedArmy.garrison || control === "vassal") ? "" : "ed-army-bar-empty"}`}>
            <Swords size={16} />
            <select
              aria-label={gameUi("Selected army")}
              value={selectedArmy?.garrison && control !== "vassal" ? "" : army}
              onChange={(e) => setArmy(e.target.value)}
            >
              <option value="">
                {gameUi(view.armies.some(
                  (a) => !a.garrison && canControl(view, actor, a),
                )
                  ? "Select a field army"
                  : "Raise a field army at your seat")}
              </option>
              {view.armies
                .filter(
                  (a) =>
                    (!a.garrison && (canControl(view, actor, a) || armyControl(view, house, a) === "awaiting")) || armyControl(view, house, a) === "vassal" && (!a.garrison || view.districts.some((d) => d.id === a.hex && d.seat)),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {gameUi(a.name)} ·{gameUi(" ")}
                    {gameUi(a.garrison ? "Vassal reserves · request service" : CONTROL_LABELS[armyControl(view, house, a)])}{gameUi(" ")}
                    · {gameUi(troopCount(a))}
                  </option>
                ))}
            </select>
            {control && <strong className={`ed-command-label ed-command-${control}`}><RealmIcon metric="loyalty" />{gameUi(CONTROL_LABELS[control])}{gameUi(control === "vassal" && armyOwner ? ` · ${armyOwner.loyalty} loyalty` : "")}</strong>}
            {gameUi(selectedArmy && !selectedArmy.garrison && (
              <span>{gameUi(" Loyalty ")}{gameUi(Math.round(armyLoyalty(view, selectedArmy)))}{gameUi("% · Food")}{gameUi(" ")}
                {gameUi(Math.round(selectedArmy.supply * 100))}{gameUi("% · Morale")}{gameUi(" ")}
                {gameUi(Math.round(selectedArmy.morale))} · {gameUi(woundedCount(selectedArmy))}{gameUi(" ")}{gameUi(" wounded · Readiness ")}{gameUi(armyHealth(selectedArmy))}% ·{gameUi(" ")}
                {gameUi(selectedArmy.voyage
                  ? "At sea"
                  : selectedArmy.path.length
                    ? "Queued for End turn"
                    : "Stationed")}
              </span>
            ))}
            <button
              hidden={control !== "own" && control !== "pledged"}
              disabled={
                !canAct ||
                !selectedArmy ||
                selectedArmy.garrison ||
                !hex ||
                !canControl(view, actor, selectedArmy) ||
                !!selectedSiege ||
                !!battle
              }
              onClick={() => execute({ type: "move", army, hex: hex!.id })}
            >{gameUi(" March here ")}<ArrowUpRight size={14} />
            </button>
            <button
              hidden={control !== "own" && control !== "pledged"}
              disabled={
                !canAct ||
                !selectedArmy ||
                selectedArmy.garrison ||
                !hex?.port ||
                !canControl(view, actor, selectedArmy) ||
                !!selectedSiege ||
                !!battle
              }
              onClick={() => execute({ type: "embark", army, hex: hex!.id })}
            >
              <Anchor size={14} />{gameUi(" Sail here ")}</button>
            {gameUi(selectedArmy &&
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
                    execute(selectedSiege ? { type: "siege", army, hex: selectedSiege.hex, stance: "lift" } : {
                      type: "blockade",
                      army,
                      enabled: !selectedArmy.blockading,
                    })
                  }
                >
                  {gameUi(selectedSiege ? "Lift siege" : selectedArmy.blockading
                    ? "Lift blockade"
                    : "Block trade here")}
                </button>
              ))}
            <button
              hidden={control !== "vassal"}
              disabled={
                !myTurn ||
                !selectedArmy ||
                !hex ||
                canControl(view, actor, selectedArmy) ||
                !!battle || !!selectedArmy.voyage || !!selectedSiege
              }
              onClick={() => execute({ type: "objective", army, hex: hex!.id })}
            >
              <RealmIcon metric="relations" />{gameUi("Request ")}{gameUi(hex?.id === selectedArmy?.hex ? "hold position" : "march here")}
            </button>
            {control === "vassal" && <small className="ed-vassal-request-note">{gameUi("Loyalty 55+ to obey.")}{gameUi(armyOwner?.summons ? ` ${armyOwner.summons}.` : "")}</small>}
            {control === "awaiting" && <small className="ed-vassal-request-note">{gameUi("Orders unlock after ")}{gameUi(selectedArmy?.delay)}{gameUi(" turn")}{gameUi(selectedArmy?.delay === 1 ? "" : "s")}{gameUi(" of travel.")}</small>}
          </div>
          <ArmyLogistics state={view} house={house} army={selectedArmy} destination={hex} />
        </section>
        <aside
          className={`ed-panel ${panelExpanded || myResponse ? "ed-panel-expanded" : ""}`}
          aria-label={gameUi("Kingdom information sidebar")}
        >
          <div className="ed-panel-dock"><span>{gameUi("REALM DESK")}</span><button className="ed-dock-side" aria-label={gameUi(`Move sidebar ${panelSide === "east" ? "left" : "right"}`)} onClick={() => setPanelSide((side) => side === "east" ? "west" : "east")}>{panelSide === "east" ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</button><button aria-label={gameUi("Close sidebar")} onClick={() => { setSidebarOpen(false); setInspectedReaction(activeReaction?.id ?? ""); }}>×</button></div>
          {activeReaction && myResponse && !battle && (
            <section
              className="ed-response-card"
              aria-label={gameUi("Diplomatic or military response")}
            >
              <span className="ed-eyebrow">{gameUi("RESPONSE REQUIRED")}</span>
              {gameUi(activeReaction.reason && (
                <p className="ed-reason">{gameUi(" War reason: ")}{gameUi(WAR_REASONS[activeReaction.reason])}
                </p>
              ))}
              {gameUi(activeReaction.hex && (
                <div className="ed-threat-info">
                  <strong>
                    {
                      gameUi(view.districts.find((d) => d.id === activeReaction.hex)
                        ?.name)
                    }
                  </strong>
                  <p>{gameUi(" Controlled by")}{gameUi(" ")}
                    {
                      gameUi(view.houses.find(
                        (h) =>
                          h.id ===
                          (view.districts.find(
                            (d) => d.id === activeReaction.hex,
                          )?.occupation ??
                            view.districts.find(
                              (d) => d.id === activeReaction.hex,
                            )?.owner),
                      )?.name)
                    }{gameUi(" ")}
                    ·{gameUi(" ")}
                    {gameUi(view.armies
                      .filter((a) => a.hex === activeReaction.hex)
                      .reduce((n, a) => n + troopCount(a), 0)
                      .toLocaleString())}{gameUi(" ")}{gameUi(" troops ")}</p>
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
                  >{gameUi(" Inspect threatened hex ")}</button>
                </div>
              ))}
              {message && <p role="alert">{gameUi(message)}</p>}
              <h2>
                {gameUi(activeReaction.kind === "attack"
                  ? `Invasion of ${view.districts.find((d) => d.id === activeReaction.hex)?.settlement}`
                  : activeReaction.kind === "war"
                    ? "A declaration of war"
                    : activeReaction.kind === "surrender"
                      ? "A castle surrender demand"
                    : activeReaction.kind === "peace"
                      ? "A peace offer"
                      : "A proposed marriage pact")}
              </h2>
              <p>
                {gameUi(view.houses.find((h) => h.id === activeReaction.from)?.name)}{gameUi(" ")}
                {gameUi(activeReaction.kind === "attack"
                  ? "is attacking your territory. Choose a defending force, withdraw, or request peace."
                  : activeReaction.kind === "war"
                    ? "has declared war. You may raise or reinforce troops at your seats before completing your response."
                    : activeReaction.kind === "peace"
                      ? "asks to end the war. Peace requires your consent."
                      : activeReaction.kind === "surrender" ? "demands the castle's surrender. Acceptance disarms the garrison and cedes occupation; refusal continues the siege." : "proposes a marriage pact. The heirs marry only if you accept.")}
              </p>
              {activeReaction.kind === "peace" && <p className="ed-response-terms">{gameUi(peaceDescription(activeReaction.terms))}</p>}
              {activeReaction.kind === "marriage" && <p className="ed-response-terms">{gameUi(activeReaction.people?.map((id) => view.houses.flatMap((h) => h.family).find((p) => p.id === id)?.name).join(" marries "))}{gameUi(". Their living marriage creates a pact and protects against border conquest.")}</p>}
              {gameUi(activeReaction.kind === "attack" ? (
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
                    >{gameUi(" Defend with ")}{gameUi(a.name)} · {gameUi(troopCount(a).toLocaleString())}
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
                  >{gameUi(" Move troops out · about 2% losses ")}</button>
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
                >{gameUi(" Defenses ready ")}</button>
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
                  >{gameUi(" Accept")}{gameUi(" ")}
                    {gameUi(activeReaction.kind === "peace"
                      ? "peace"
                      : activeReaction.kind === "surrender" ? "castle surrender" : "marriage pact")}
                  </button>
                  <button
                    onClick={() =>
                      execute({
                        type: "respond",
                        reaction: activeReaction.id,
                        choice: "decline",
                      })
                    }
                  >{gameUi(" Decline proposal ")}</button>
                </>
              ))}
              {gameUi((activeReaction.kind === "attack" ||
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
                >{gameUi(" Request peace ")}</button>
              ))}
            </section>
          )}

          <nav className="ed-panel-tabs">
            {["district", "houses", "council", "dynasty", "economy", "chronicle"].map(
              (t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => {
                    setTab(t);
                    setInspectedReaction(activeReaction?.id ?? "");
                  }}
                >
                  {gameUi(t)}
                </button>
              ),
            )}
          </nav>
          <button
            className="ed-panel-size"
            aria-expanded={panelExpanded}
            onClick={() => setPanelExpanded((v) => !v)}
          >
            {gameUi(panelExpanded ? "Compact sidebar" : "Expand sidebar")}
          </button>
          <button
            className="ed-panel-minimap"
            aria-label={gameUi("World minimap — return to world")}
            onClick={resetCamera}
          >
            {gameUi(map(true))}
          </button>
          {gameUi(tab === "district" && (
            <div className="ed-actions-fieldset">
              {gameUi(hex?.biome === "legacy" ? (
                <section className="ed-legacy-info">
                  <span className="ed-eyebrow">{gameUi("THE OLD KINGDOMS")}</span>
                  <h2>{gameUi("Legacy Region")}</h2>
                  <p>{gameUi(" The original Medieval Kingdoms campaign, with its own rulers, armies and saved progress. ")}</p>
                  <p className="ed-reason">{gameUi(" Legacy Region — unavailable in this campaign. Edravane armies and trade cannot enter it. ")}</p>
                  <Link
                    className="ed-primary ed-visit"
                    to="/games/medieval-kingdoms/legacy"
                  >{gameUi(" Visit the old kingdoms ")}<ArrowUpRight size={15} />
                  </Link>
                </section>
              ) : hex && owner ? (
                <>
                  <div className="ed-panel-title">
                    <span className="ed-eyebrow">{gameUi(" SELECTED DISTRICT · ")}{gameUi(hex.id)}
                    </span>
                    <h2>{gameUi(hex.settlement)}</h2>
                    <p>{gameUi(hex.name)}</p>
                    <p className={`ed-territory-label ed-territory-${territoryControl(view, house, hex)}`}><RealmIcon metric="legitimacy" />{gameUi(territoryControl(view, house, hex) === "domain" ? "Your domain · direct rule" : territoryControl(view, house, hex) === "vassal" ? "Vassal estate · governed by its house" : "Outside your direct rule")}</p>
                    {territoryControl(view, house, hex) === "vassal" && <button className="ed-request-host" onClick={() => { const host = view.armies.find((a) => a.house === (hex.occupation ?? hex.owner) && !a.garrison && !a.pledgedTo && !a.rebel) ?? view.armies.find((a) => a.house === (hex.occupation ?? hex.owner) && a.garrison && !a.rebel); if (host) { setArmy(host.id); if (window.matchMedia("(max-width: 700px)").matches) setSidebarOpen(false); } }}><RealmIcon metric="troops" />{gameUi("Request this vassal’s host")}</button>}
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
                      >{gameUi(" House")}{gameUi(" ")}
                        {
                          view.houses.find(
                            (h) => h.id === (hex.occupation ?? owner.id),
                          )!.name
                        }
                      </button>{gameUi(" ")}
                      ·{gameUi(" ")}
                      {gameUi(view.armies
                        .filter((a) => a.hex === hex.id)
                        .reduce((n, a) => n + troopCount(a), 0)
                        .toLocaleString())}{gameUi(" ")}{gameUi(" troops ")}</p>
                  </div>
                  <div
                    className="ed-terrain"
                    style={{ background: BIOMES[hex.biome].color }}
                  >
                    <span>{gameUi(BIOMES[hex.biome].icon)}</span>
                    <div>
                      <strong>{gameUi(hex.biome)}</strong>
                      <small>{gameUi(BIOMES[hex.biome].description)}</small>
                    </div>
                  </div>
                  <dl className="ed-details">
                    <dt>{gameUi("Troops on hex")}</dt>
                    <dd>
                      {gameUi(view.armies
                        .filter((a) => a.hex === hex.id)
                        .reduce((n, a) => n + troopCount(a), 0)
                        .toLocaleString())}{gameUi(" ")}{gameUi(" total ")}</dd>
                    <dt>{gameUi("Owner")}</dt>
                    <dd style={{ color: owner.color }}>
                      <button
                        className="ed-house-link"
                        onClick={() => visitHouse(owner)}
                      >
                        {gameUi(owner.crest)}{gameUi(" House ")}{owner.name}
                        {gameUi(owner.id === house.id ? " · ♛" : "")}
                      </button>
                    </dd>
                    <dt>{gameUi("Liege")}</dt>
                    <dd>
                      {gameUi(liege ? (
                        <button
                          className="ed-house-link"
                          onClick={() => visitHouse(liege)}
                        >{gameUi(" House ")}{gameUi(liege.name)}
                        </button>
                      ) : (
                        "Crown domain"
                      ))}
                    </dd>
                    <dt>{gameUi("Resource")}</dt>
                    <dd>
                      {gameUi(hex.resource)} · {gameUi(hex.port ? "Port" : "Landlocked")}
                      {gameUi(hex.shipyard ? " / shipyard" : "")}
                    </dd>
                    {gameUi(hex.seat && (
                      <>
                        <dt>{gameUi("House seat")}</dt>
                        <dd>
                          {gameUi(hex.seat === "capital" ? "Capital" : "Secondary")} ·{gameUi(" ")}
                          {gameUi(view.armies
                            .filter(
                              (a) =>
                                a.garrison &&
                                a.hex === hex.id &&
                                a.house === owner.id,
                            )
                            .reduce((n, a) => n + troopCount(a), 0)
                            .toLocaleString())}{gameUi(" ")}{gameUi(" troops ")}</dd>
                      </>
                    ))}
                    {gameUi(hex.city && (
                      <>
                        <dt>{gameUi("City")}</dt>
                        <dd>
                          {gameUi(hex.city === "major" ? "Major city" : "Market city")}{gameUi(" ")}{gameUi(" · +12 trade cargo · ")}{gameUi(hex.city === "major" ? 4 : 2)}{gameUi(" ")}{gameUi(" coins/turn ")}</dd>
                      </>
                    ))}
                    {gameUi(hex.castle && (
                      <>
                        <dt>{gameUi("Castle")}</dt>
                        <dd>{gameUi(" Level ")}{gameUi(hex.castle.level)} · {gameUi(castleGuard(view, hex))}{gameUi(" ")}{gameUi(" guards · +")}{gameUi(Math.round(castleBonus(hex) * 100))}{gameUi("% defense ")}</dd>
                      </>
                    ))}
                    <dt>{gameUi("Loyalty")}</dt>
                    <dd>{gameUi(owner.loyalty)}/100</dd>
                    <dt>{gameUi("Unrest")}</dt>
                    <dd>{gameUi(hex.unrest)}/100</dd>
                    <dt>{gameUi("Obligation")}</dt>
                    <dd>{gameUi(owner.obligation)}{gameUi(" contracted troops")}</dd>
                    <dt>{gameUi("Pledged")}</dt>
                    <dd>
                      {gameUi(view.armies
                        .filter((a) => a.house === owner.id && a.pledgedTo)
                        .reduce((n, a) => n + troopCount(a), 0))}{gameUi(" ")}{gameUi(" troops ")}</dd>
                    <dt>{gameUi("Status")}</dt>
                    <dd>
                      {gameUi(hex.occupation
                        ? `▨ Occupied by ${view.houses.find((h) => h.id === hex.occupation)?.name}`
                        : hex.disputed
                          ? "┄ Disputed claim"
                          : "Stable possession")}
                    </dd>
                  </dl>
                  <section
                    className="ed-hex-forces"
                    aria-label={gameUi("Troops stationed on this hex")}
                  >
                    {view.armies
                      .filter(
                        (a) =>
                          a.hex === hex.id &&
                          (troopCount(a) > 0 || woundedCount(a) > 0),
                      )
                      .map((a) => (
                        <div className="ed-profile-army" key={a.id}>
                          <strong>{gameUi(a.name)}</strong>
                          <small>
                            {gameUi(troopCount(a).toLocaleString())}{gameUi(" troops ·")}{gameUi(" ")}
                            {gameUi(a.rebel
                              ? "Rebel"
                              : a.garrison
                                ? "Garrison"
                                : "Field army")}{gameUi(" ")}{gameUi(" · Morale ")}{gameUi(Math.round(a.morale))}{gameUi(" · Loyalty")}{gameUi(" ")}
                            {gameUi(Math.round(armyLoyalty(view, a)))}% ·{gameUi(" ")}
                            {gameUi(woundedCount(a))}{gameUi(" wounded · Readiness")}{gameUi(" ")}
                            {gameUi(armyHealth(a))}%
                          </small>
                          {gameUi(canControl(view, actor, a) && !a.garrison && (
                            <button onClick={() => setArmy(a.id)}>{gameUi(" Select this army ")}</button>
                          ))}
                        </div>
                      ))}
                  </section>
                  {gameUi(attackNation && attackNation !== nation && (
                    <WarActions
                      state={view}
                      house={house}
                      nation={attackNation}
                      field={hex}
                      army={selectedArmy}
                      active={myTurn && !battle}
                      onCommand={execute}
                    />
                  ))}
                  {gameUi(fieldEnemy?.rebel && attackNation === nation && (
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
                    >{gameUi(" Attack rebel forces ")}</button>
                  ))}
                  {gameUi(owner.id === house.id && (
                    <fieldset
                      className="ed-estate-actions ed-actions-fieldset"
                      disabled={!canAct || !!battle}
                    >
                      {gameUi(hex.farm && (
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
                          <Leaf size={14} />{gameUi(" Harvest ")}{gameUi(harvestYield(hex))}{gameUi(" food")}{gameUi(" ")}
                          {gameUi(hex.harvestedAt !== undefined &&
                          view.tick - hex.harvestedAt < HARVEST_COOLDOWN
                            ? `· ready in ${HARVEST_COOLDOWN - (view.tick - hex.harvestedAt)} turns`
                            : "")}
                        </button>
                      ))}
                      {gameUi(hex.castle && hex.castle.level < 3 && (
                        <button
                          disabled={!!battle || !!hex.occupation}
                          onClick={() =>
                            execute({ type: "upgradeCastle", hex: hex.id })
                          }
                        >
                          <Shield size={14} />{gameUi(" Upgrade to level")}{gameUi(" ")}
                          {gameUi(hex.castle.level + 1)} ·{gameUi(" ")}
                          {gameUi(hex.castle.level === 1 ? 150 : 300)}{gameUi(" coins · 30 timber · 20 iron ")}</button>
                      ))}
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
                              <Swords size={14} />{gameUi(" Raise 500 troops · 50 coins · 20 food ")}</button>
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
                            >{gameUi(" Recruit 100 reserve troops · 100 coins · 50 food ")}</button>
                          </div>
                        ))}
                      <p className="ed-reason">{gameUi(" Seat troops include the 500 castle guards. Raising an army transfers reserves and keeps the guards at home. Field troops also need food and wages each turn. ")}</p>
                    </fieldset>
                  ))}
                  {owner.reasons.map((r, i) => (
                    <p className="ed-reason" key={i}>
                      {gameUi(r)}
                    </p>
                  ))}
                  <DistrictStrategy state={view} house={house} district={hex} army={selectedArmy} active={myTurn && !battle} onCommand={execute} />
                  <div className="ed-mobile-logistics"><ArmyLogistics state={view} house={house} army={selectedArmy} destination={hex} /></div>
                  {(view.intelligence?.[house.id] ?? []).filter((r) => r.hex === hex.id && !view.armies.some((a) => a.id === r.army)).map((r) => <p className="ed-intel-report" key={r.army}>{gameUi(r.name)}{gameUi(": approximately ")}{gameUi(r.low)}–{gameUi(r.high)}{gameUi(" soldiers, last seen round ")}{gameUi(r.seen)}{gameUi(". Their current position and strength are unknown.")}</p>)}
                  {gameUi(hex.occupation && (
                    <button
                      disabled={!myTurn}
                      onClick={() => execute({ type: "annex", hex: hex.id })}
                    >{gameUi(" Annex estate · 50 coins / 3 turns of occupation ")}</button>
                  ))}
                  {gameUi(owner.liege === house.id && (
                    <button
                      disabled={!canAct || !!battle}
                      onClick={() =>
                        execute({ type: "summon", house: owner.id })
                      }
                    >
                      <Flag size={14} />{gameUi(" Summon this house ")}</button>
                  ))}
                  {gameUi(hex.owner === house.id && hex.port && !hex.shipyard && (
                    <button
                      disabled={!myTurn || !!battle}
                      onClick={() => execute({ type: "shipyard", hex: hex.id })}
                    >{gameUi(" Build shipyard · 100 coins / 30 timber ")}</button>
                  ))}
                  {gameUi(hex.bonus && (
                    <div className="ed-challenge-note">
                      <strong>
                        {gameUi(hex.bonus === "gold"
                          ? "● Merchant’s table"
                          : "⚑ Tournament field")}
                      </strong>
                      <p>
                        {gameUi(hex.bonus === "gold"
                          ? "A fair bargain earns 60 coins."
                          : "Read the battlefield and earn 20 levies.")}{gameUi(" ")}{gameUi(" Three rewards per field; 30-turn cooldown. ")}</p>
                      <button
                        disabled={
                          !myTurn || hex.owner !== house.id || !!activeChallenge
                        }
                        onClick={() =>
                          execute({ type: "challenge", hex: hex.id })
                        }
                      >{gameUi(" Enter challenge ")}</button>
                      <small>
                        {gameUi(view.rewards[`${house.id}|${hex.id}`] &&
                          `Claimed ${view.rewards[`${house.id}|${hex.id}`].count}/3 · next turn ${view.rewards[`${house.id}|${hex.id}`].next + 1}`)}
                      </small>
                    </div>
                  ))}
                </>
              ) : hex ? (
                <section>
                  <div className="ed-panel-title">
                    <span className="ed-eyebrow">{gameUi("SELECTED HEX · ")}{gameUi(hex.id)}</span>
                    <h2>{gameUi(hex.name)}</h2>
                    <p>{gameUi(BIOMES[hex.biome].description)}</p>
                  </div>
                  <p>
                    {gameUi(view.armies
                      .filter((a) => a.hex === hex.id)
                      .reduce((n, a) => n + troopCount(a), 0))}{gameUi(" ")}{gameUi(" troops · No house owns this sea field. ")}</p>
                  <p>
                    {gameUi(view.routes.filter((r) => r.path.includes(hex.id)).length)}{gameUi(" ")}{gameUi(" trade routes cross this field. ")}</p>
                </section>
              ) : (
                <div className="ed-panel-empty">
                  <Crown size={32} />
                  <h2>{gameUi("The realm awaits")}</h2>
                  <p>{gameUi(" Select a hex to inspect its estate, resources, loyalty, and military obligations. ")}</p>
                </div>
              ))}
            </div>
          ))}
          {tab === "houses" && (
            <>
              <label>{gameUi(" Navigate to a house ")}<select
                  aria-label={gameUi("Navigate to a house")}
                  value={profileHouse.id}
                  onChange={(e) =>
                    visitHouse(
                      view.houses.find((h) => h.id === e.target.value)!,
                    )
                  }
                >
                  {NATIONS.map((n) => (
                    <optgroup key={n.id} label={gameUi(n.name)}>
                      {view.houses
                        .filter((h) => h.nation === n.id)
                        .map((h) => (
                          <option key={h.id} value={h.id}>{gameUi(" House ")}{gameUi(h.name)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="ed-house-directory" aria-label={gameUi("Great houses")}>
                {view.titles.map((t) => {
                  const h = view.houses.find((h) => h.id === t.holder)!;
                  return (
                    <button
                      key={t.id}
                      className={profileHouse.id === h.id ? "active" : ""}
                      onClick={() => visitHouse(h)}
                    >
                      <HouseSigil house={h} size={18} /> {gameUi(h.name)}
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
              {gameUi(profileHouse.nation !== nation && (
                <WarActions
                  state={view}
                  house={house}
                  nation={profileHouse.nation}
                  army={selectedArmy}
                  active={myTurn && !battle}
                  onCommand={execute}
                />
              ))}
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
          {gameUi(tab === "council" && (
            <div className="ed-actions-fieldset">
              <KingdomIdentity nation={house.nation} />
              <div className="ed-panel-title">
                <span className="ed-eyebrow">{gameUi("THE FEUDAL COUNCIL")}</span>
                <h2>{gameUi("Oaths & ambitions")}</h2>
                <p>{gameUi(" Loyalty combines personal opinion and legitimacy. Contracts set service obligations. ")}</p>
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
                        {gameUi(v.crest)} {gameUi(v.name)}
                      </button>
                      <b className={v.loyalty < 40 ? "ed-danger" : ""}>
                        {gameUi(v.loyalty)}%
                      </b>
                    </div>
                    <p>{gameUi(v.ambition)}</p>
                    <VassalBargain state={view} house={house} vassal={v} active={myTurn && !battle} onCommand={execute} />
                    <small>{gameUi(" Opinion ")}{gameUi(v.opinion)}{gameUi(" · Legitimacy ")}{gameUi(v.legitimacy)} ·{gameUi(" ")}
                      {gameUi(v.obligation)}{gameUi(" troops ")}</small>
                    <p className="ed-reason">
                      {gameUi(v.rebellion
                        ? "⚑ REBELLION"
                        : v.loyalty < 40
                          ? "⚠ Likely refusal / pretender support"
                          : v.loyalty < 60
                            ? "⚠ Delays and reduced commitment"
                            : "Ready for campaign service")}{gameUi(" ")}
                      · {gameUi(v.summons)}
                    </p>
                    <div>
                      <button
                        disabled={!canAct || !!battle}
                        onClick={() => execute({ type: "summon", house: v.id })}
                      >{gameUi(" Summon ")}</button>
                      <button
                        disabled={!myTurn}
                        onClick={() =>
                          execute({ type: "concession", house: v.id })
                        }
                      >{gameUi(" Concession · 40 ")}</button>
                      {gameUi(v.role === "claimant" && (
                        <button
                          disabled={!myTurn}
                          onClick={() =>
                            execute({ type: "pretender", house: v.id })
                          }
                        >{gameUi(" Support claim · 80 ")}</button>
                      ))}
                    </div>
                  </div>
                ))}
              <h3>{gameUi("Foreign crowns")}</h3>
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
                    {gameUi(n.crest)} {gameUi(n.name)}
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
                  >{gameUi(" Propose marriage · 30 coins ")}</button>
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
          ))}
          {tab === "dynasty" && (
            <fieldset
              className="ed-actions-fieldset"
              disabled={!canAct || !!battle}
            >
              <div className="ed-panel-title">
                <span className="ed-eyebrow">{gameUi(" HOUSE ")}{gameUi(house.name.toUpperCase())}
                </span>
                <h2>{gameUi("The line of succession")}</h2>
                <p>{gameUi(NATIONS.find((n) => n.id === nation)!.succession)}</p>
              </div>
              <Personality person={ruler(house)} />
              <SuccessionPlanner state={view} house={house} active={myTurn && !battle} onCommand={execute} />
              <MarriagePlanner state={view} house={house} active={myTurn && !battle} onCommand={execute} />
              {house.family.map((p) => (
                <div className="ed-person" key={p.id}>
                  <CharacterPortrait person={p} house={house} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {gameUi(p.gender)} · {gameUi(p.age)}{gameUi(" years ·")}{gameUi(" ")}
                      {gameUi(!p.alive
                        ? "Deceased"
                        : p.id === house.ruler
                          ? "Ruling"
                          : heir(view, house)?.id === p.id
                            ? "Eligible heir"
                            : "Family")}
                    </small>
                    <small>
                      {gameUi(p.parents.length
                        ? `Child of ${house.family.find((a) => a.id === p.parents[0])?.name}`
                        : "Dynasty founder")}
                    </small>
                    {gameUi(p.spouse && (
                      <small>{gameUi(" Married to")}{gameUi(" ")}
                        {
                          view.houses
                            .flatMap((h) => h.family)
                            .find((a) => a.id === p.spouse)?.name
                        }
                      </small>
                    ))}
                    {gameUi(p.imprisonedBy && (
                      <small className="ed-danger">{gameUi(" Prisoner of ")}{gameUi(p.imprisonedBy)}
                      </small>
                    ))}
                    {p.claim && <small>{gameUi("Claim to the crown of ")}{gameUi(p.claim)}</small>}
                  </div>
                </div>
              ))}
              <button disabled={!myTurn || !successionPreview(view, house).next || !successionPreview(view, house).recognized} onClick={() => execute({ type: "succession" })}>{gameUi(" Pass the crown to the eligible heir ")}</button>
              <h3>{gameUi("Titles held")}</h3>
              {view.titles
                .filter((t) => t.holder === house.id)
                .map((t) => (
                  <p key={t.id}>{gameUi("♛ Crown of ")}{gameUi(t.nation)}</p>
                ))}
              <p className="ed-reason">{gameUi(" Titles belong to houses, and can change hands after a claimant victory. Land ownership and troop origins remain distinct. ")}</p>
            </fieldset>
          )}
          {gameUi(tab === "economy" && (
            <fieldset
              className="ed-actions-fieldset"
              disabled={!canAct || !!battle}
            >
              <div className="ed-panel-title">
                <span className="ed-eyebrow">{gameUi("TREASURY & SUPPLY")}</span>
                <h2>{gameUi("The lifeblood of a realm")}</h2>
                <p>{gameUi(" Food sustains armies. Timber builds ships. Iron equips soldiers. Ports connect distant estates. ")}</p>
              </div>
              <div className="ed-ledger">
                {RESOURCES.map((r) => (
                  <div
                    key={r}
                    title={gameUi(`Price bounded 1–12 coins; base × 1800 / max(900, total world stock). Current ${view.prices[r]} coins.`)}
                  >
                    <span>{gameUi(r)}</span>
                    <b className={house.stock[r] < 15 ? "ed-danger" : ""}>
                      {gameUi(Math.floor(house.stock[r]))}
                    </b>
                    <small>{gameUi(view.prices[r])}{gameUi(" coins")}</small>
                  </div>
                ))}
              </div>
              <h3>{gameUi("Establish a route")}</h3>
              <p className="ed-reason">{gameUi(" Select your origin estate on the map. Approved merchants move automatically, carrying 12 land or 24 maritime cargo. ")}</p>
              <label>{gameUi(" Cargo ")}<select
                  value={resource}
                  onChange={(e) => setResource(e.target.value as Resource)}
                >
                  {RESOURCES.map((r) => (
                    <option key={r}>{gameUi(r)}</option>
                  ))}
                </select>
              </label>
              <label>{gameUi(" Destination ")}<select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">{gameUi("Choose a market")}</option>
                  {view.districts
                    .filter(
                      (d) =>
                        d.owner && d.id !== selected && (!maritime || d.port),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {gameUi(d.name)} ·{gameUi(" ")}
                        {gameUi(view.houses.find((h) => h.id === d.owner)?.name)}
                        {gameUi(d.port ? " ⚓" : "")}
                      </option>
                    ))}
                </select>
              </label>
              <label className="ed-checkbox">
                <input
                  type="checkbox"
                  checked={importCargo}
                  onChange={(e) => setImportCargo(e.target.checked)}
                />{gameUi(" ")}{gameUi(" Import cargo into your estate ")}</label>
              <label className="ed-checkbox">
                <input
                  type="checkbox"
                  checked={maritime}
                  onChange={(e) => setMaritime(e.target.checked)}
                />{gameUi(" ")}{gameUi(" Maritime · shipyard required ")}</label>
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
                <Anchor size={14} />{gameUi(" Approve ")}{gameUi(maritime ? "ship" : "caravan")}{gameUi(" ")}{gameUi(" route ")}</button>
              <p className="ed-reason">{gameUi(" Land setup 25 coins; ship 80 coins / 20 timber (Saltmere shipyard −15%). Transport costs 1 / 3 coins. Sea storm chance")}{gameUi(" ")}
                {gameUi(view.config.maritimeHazard * 100)}{gameUi("% per delivery; one foreign troop can stop trade. Blocking trade in peacetime gives the affected crown a justified war reason. ")}</p>
              {view.routes
                .filter((r) => r.house === house.id)
                .map((r) => (
                  <div className="ed-route" key={r.id}>
                    <b>
                      {gameUi(r.maritime ? "⚓" : "♘")} {gameUi(r.resource)} ·{gameUi(" ")}
                      {gameUi(Math.floor(r.delivered))}{gameUi(" delivered ")}</b>
                    <small>
                      {gameUi(routeBlockers(view, r).length
                        ? `Blocked by ${routeBlockers(view, r)
                            .map((a) => a.name)
                            .join(", ")} · justification to declare war`
                        : r.status)}
                    </small>
                  </div>
                ))}
              <h3>{gameUi("Food and armies")}</h3>
              <p className="ed-reason">{gameUi(" Harvest your farmland in the District tab, or import grain through trade. City endpoints each add 12 cargo capacity. Raise a field host from a seat for 50 coins and 20 food per 500 troops; recruit reserves to grow your force. ")}</p>
              <h3>{gameUi("Reinforce selected troops")}</h3>
              <UnitGuide />
              {gameUi(selectedArmy?.house === house.id ? (
                unitKinds.map((k) => (
                  <button
                    key={k}
                    onClick={() =>
                      execute({ type: "recruit", army, kind: k, count: 100 })
                    }
                  >
                    +100 {gameUi(labels[k])} · {gameUi(UNIT_STATS[k].cost * 100)}{gameUi(" coins · 50 food")}{gameUi(k !== "levies" ? " · 50 iron" : "")}
                    {gameUi(k === "cavalry" ? " · 50 horses" : "")}
                  </button>
                ))
              ) : (
                <p>{gameUi("Select your royal army to recruit at its estate.")}</p>
              ))}
            </fieldset>
          ))}
          <div className="ed-sidebar-tools">
            {gameUi(online ? (
              <button onClick={() => connect("resume")}>{gameUi("Reconnect")}</button>
            ) : (
              <>
                <button onClick={save}>{gameUi("Save campaign")}</button>
                <button onClick={exportSave}>{gameUi("Export save")}</button>
              </>
            ))}
          </div>
          {tab === "chronicle" && <Chronicle state={view} onHouse={visitHouse} onHex={(d) => { select(d); setMapCenter(center(d)); setMapZoom(2.8); }} />}
          {gameUi(message && (
            <p className="ed-notice" role="alert">
              {gameUi(message)}
            </p>
          ))}
        </aside>
      </div>
      <footer className="ed-journal">
        <span>{gameUi(" CHRONICLE ")}<span className="ed-dot">●</span>
        </span>
        <p>{gameUi(message || view.events?.[0]?.title || "Your reign begins. Plan your alliances and call your banners.")}</p>
        <button onClick={() => { setSidebarOpen(true); setTab("chronicle"); }}>{gameUi(" Read chronicle ")}<ChevronRight size={14} />
        </button>
      </footer>
      <details className="ed-history">
        <summary>{gameUi("Routine reports · ")}{gameUi(view.log.length)}{gameUi(" entries")}</summary>
        {view.log.map((l, i) => (
          <p key={i}>{gameUi(l)}</p>
        ))}
      </details>
      {gameUi(activeChallenge && (
        <div className="ed-modal-backdrop">
          <section className="ed-modal">
            <span className="ed-eyebrow">
              {gameUi(activeChallenge.kind === "gold"
                ? "THE MERCHANT’S TABLE"
                : "THE SILVER TOURNAMENT")}
            </span>
            <h2>
              {gameUi(activeChallenge.kind === "gold"
                ? "Strike a fair bargain"
                : "Command the field")}
            </h2>
            <p>{gameUi(activeChallenge.question)}</p>
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
                {gameUi(i + 1)}. {gameUi(c)}
              </button>
            ))}
            <small>{gameUi(" One attempt. Rewards and cooldowns are validated by the campaign authority. ")}</small>
          </section>
        </div>
      ))}
      {gameUi(battle?.rounds && hiddenBattle !== battle.id && (
        <BattleRoundPanel
          key={`${battle.id}:${battle.rounds.round}`}
          state={view}
          battle={battle}
          house={house}
          onCommand={execute}
          onInspect={() => setHiddenBattle(battle.id)}
          message={message}
        />
      ))}
      {gameUi(!battle &&
        latestBattleReport &&
        dismissedBattleReport !== latestBattleReport.id && (
          <BattleOutcome
            report={latestBattleReport}
            onClose={() => setDismissedBattleReport(latestBattleReport.id)}
          />
        ))}
      {gameUi(battle && !battle.rounds && hiddenBattle !== battle.id && (
        <div className="ed-battle-backdrop">
          <section className="ed-battle-modal">
            <header>
              <div>
                <span className="ed-eyebrow">{gameUi(" ENCOUNTER ")}{gameUi(battle.id)} · {gameUi(view.battles.length)}{gameUi(" QUEUED ")}</span>
                <h2>{gameUi(view.districts.find((d) => d.id === battle.hex)!.name)}</h2>
              </div>
              <span>{gameUi(" Campaign frozen · ")}{gameUi(Math.floor(battle.seconds))}s{gameUi(" ")}
                <button onClick={() => setHiddenBattle(battle.id)}>{gameUi(" Inspect frozen campaign ")}</button>
              </span>
            </header>
            <div className="ed-battle-content">
              <div className="ed-tactical-wrap">
                <svg
                  viewBox="0 0 100 100"
                  aria-label={gameUi("Tactical formation battlefield")}
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
                  {gameUi(field!.river && (
                    <rect
                      x="44"
                      width="12"
                      height="100"
                      fill="#63a4bd"
                      opacity=".8"
                    />
                  ))}
                  {gameUi(field!.road && (
                    <path d="M0 50H100" stroke="#d1bb89" strokeWidth="5" />
                  ))}
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
                    {gameUi(field!.settlement)}
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
                            {gameUi(Math.ceil(f.count))}
                          </text>
                          <title>
                            {gameUi(labels[f.kind])}{gameUi(" · morale ")}{gameUi(Math.floor(f.morale))}{gameUi(" · fatigue ")}{gameUi(Math.floor(f.fatigue))} · {gameUi(f.order)}
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
                  {gameUi(field!.forest
                    ? "Woodland reduces archery visibility and movement."
                    : field!.river
                      ? "River crossing slows formations; road provides a ford."
                      : field!.hill
                        ? "High ground favours the defender."
                        : "Open ground favours cavalry.")}{gameUi(" ")}{gameUi(" Reserves engage after 12s. Routed troops flee. ")}</p>
              </div>
              <aside className="ed-battle-controls">
                {battle.armies.map((id) => {
                  const a = view.armies.find((a) => a.id === id)!;
                  return (
                    <div key={id}>
                      <h3>{gameUi(a.name)}</h3>
                      <p>
                        {gameUi(canControl(view, actor, a)
                          ? "Authorized command"
                          : "AI commander / opposing player")}{gameUi(" ")}{gameUi(" · approach ")}{gameUi(battle.approaches[id])}
                      </p>
                      {gameUi(battle.phase === "encounter" &&
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
                            >{gameUi(" Stand and fight ")}</button>
                            <button
                              onClick={() =>
                                execute({
                                  type: "retreat",
                                  battle: battle.id,
                                  army: id,
                                })
                              }
                            >{gameUi(" Attempt withdrawal ")}</button>
                          </>
                        ))}
                    </div>
                  );
                })}
                {gameUi(battle.phase === "combat" && (
                  <>
                    <label>{gameUi(" Formation ")}<select
                        value={formation}
                        onChange={(e) => setFormation(e.target.value)}
                      >
                        <option value="">{gameUi("Select formation")}</option>
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
                              {gameUi(labels[f.kind])} · {gameUi(Math.ceil(f.count))} ·{gameUi(" ")}
                              {gameUi(f.routed ? "Routed" : f.order)}
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
                          {gameUi(o)}
                        </button>
                      ))}
                    </div>
                    <label>{gameUi(" Facing · ")}{gameUi(facing)}°
                      <input
                        type="range"
                        min="0"
                        max="359"
                        value={facing}
                        onChange={(e) => setFacing(Number(e.target.value))}
                      />
                    </label>
                    <label>{gameUi(" Width · ")}{gameUi(width)}
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
                    >{gameUi(" Issue order at selected point ")}</button>
                    <p className="ed-reason">{gameUi(" Select a formation and an order, then click the field. Hold restores fatigue; charges tire quickly. Face vulnerable flanks toward the enemy. ")}</p>
                    <button
                      onClick={() =>
                        execute({
                          type: "battlePause",
                          battle: battle.id,
                          approve: !battle.pauseVotes.includes(house.id),
                        })
                      }
                    >
                      {gameUi(battle.pauseVotes.includes(house.id)
                        ? "Resume vote"
                        : "Request tactical pause")}
                    </button>
                    <small>
                      {gameUi(battle.pauseVotes.length)}{gameUi(" pause votes ·")}{gameUi(" ")}
                      {gameUi(online
                        ? "Unanimous participants required"
                        : "Single-player tactical pause")}
                    </small>
                  </>
                ))}
                {message && <p className="ed-notice">{gameUi(message)}</p>}
              </aside>
            </div>
          </section>
        </div>
      ))}
    </main>,
    document.body,
  );
}
