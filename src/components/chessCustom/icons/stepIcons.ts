import type { CreateStep, PlayMode, SimulationSidebarItem, TopLevelArea } from "@/games/chess/custom/library/navigation";
import {
  BoardIcon,
  CommunityIcon,
  CreateIcon,
  EventsIcon,
  HotseatIcon,
  MultiplayerIcon,
  MyGamesIcon,
  OverviewIcon,
  PiecesIcon,
  PlayIcon,
  PositionIcon,
  RulesIcon,
  SettingsIcon,
  SimulationIcon,
  SingleplayerIcon,
  TeamsIcon,
  VictoryIcon,
  type ChessIcon,
} from "./ChessCustomIcons";

export const AREA_ICONS: Record<TopLevelArea, ChessIcon> = { library: MyGamesIcon, create: CreateIcon, pluto: OverviewIcon, community: CommunityIcon };

export const STEP_ICONS: Record<CreateStep, ChessIcon> = {
  overview: OverviewIcon,
  board: BoardIcon,
  teams: TeamsIcon,
  pieces: PiecesIcon,
  rules: RulesIcon,
  events: EventsIcon,
  victory: VictoryIcon,
  position: PositionIcon,
  simulation: SimulationIcon,
};

export const PLAY_MODE_ICONS: Record<PlayMode, ChessIcon> = { singleplayer: SingleplayerIcon, multiplayer: MultiplayerIcon, hotseat: HotseatIcon };

export const SIMULATION_SIDEBAR_ICONS: Record<SimulationSidebarItem, ChessIcon> = { play: PlayIcon, board: BoardIcon, customize: CreateIcon, settings: SettingsIcon };
