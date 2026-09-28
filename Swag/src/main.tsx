import LearnPage from "./pages/general/LearnPage";
import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";

import App from "./App";
import ChessGame from "./pages/games/Chess/ChessGames.tsx";
import RootLayout from "./components/App/RootLayout.tsx";
import LandingPage from "./pages/general/LandingPage.tsx";

import AppLayout from "./components/App/AppLayout.tsx";
import NotFoundPage from "./pages/general/NotFoundPage.tsx";
import Watten from "./pages/games/Watten/Watten.tsx";
import WattenHotseat from "./pages/games/Watten/WattenHotseat.tsx";
import WattenHotseatPage from "./pages/games/Watten/WattenGamePage.tsx";
import WattenSingleplayer from "./pages/games/Watten/WattenSingleplayer.tsx";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import WattenRules from "./pages/games/Watten/WattenRules.tsx";
import { CardThemeProvider } from "./context/CardThemeContext";
import { TableThemeProvider } from "./context/TableThemeContext";
import WattenMultiplayerLobby from "./components/Watten/WattenMultiplayerLobby.tsx";
import WattenMultiplayerGame from "./components/Watten/WattenMultiplayerGame.tsx";
import ChessClassicMenu from "./pages/games/Chess/ChessClassicalMenu.tsx";
import ChessMenu from "./pages/games/Chess/ChessMenu.tsx";
import ChessComputer from "./pages/games/Chess/ChessComputer.tsx";
import ChessMultiplayerLobby from "./pages/games/Chess/ChessMultiplayerLobby.tsx";
import ChessMultiplayerModeMenu from "./pages/games/Chess/ChessMultiplayerModeMenu.tsx";
import ChessRankedLobby from "./pages/games/Chess/ChessRankedLobby.tsx";
import ChessMultiplayerRoom from "./pages/games/Chess/ChessMultiplayerRoom.tsx";
import ChessMultiplayerGame from "./pages/games/Chess/ChessMultiplayerGame.tsx";
import GroupsPage from "./pages/social/GroupsPage.tsx";
import LeaderboardsPage from "./pages/social/LeaderboardsPage.tsx";
import ChessRulesAndTips from "./components/chess/singleplayer/ChessRulesAndTips.tsx";
import ChessPuzzlesPage from "./components/chess/singleplayer/ChessPuzzlesPage.tsx";
import ChessAudioSettings from "./components/chess/ChessAudioSettings.tsx";
import { unlockChessAudio } from "./games/chess/audio/chessAudio.ts";
import ChessVariantsMenu from "./pages/games/Chess/ChessVariantsMenu.tsx";
import ThreeLivesChessBoard from "./components/chess/singleplayer/ThreeLivesChessBoard.tsx";
import MutationChessBoard from "./components/chess/singleplayer/MutationChessBoard.tsx";
import CapitalismChessBoard from "./components/chess/singleplayer/CapitalismChessBoard.tsx";
import CapitalismChessRules from "./components/chess/singleplayer/CapitalismChessRules.tsx";
import HorrorChessRules from "./components/chess/singleplayer/HorrorChessRules.tsx";
import HorrorChessBoard from "./components/chess/singleplayer/HorrorChessBoard.tsx";
import FogOfWarChessBoard from "./components/chess/singleplayer/FogOfWarChessBoard.tsx";
import FogOfWarChessRules from "./components/chess/singleplayer/FogOfWarChessRules.tsx";
import DraftChessBoard from "./components/chess/singleplayer/DraftChessBoard.tsx";
import DraftChessRules from "./components/chess/singleplayer/DraftChessRules.tsx";
import MirrorChessBoard from "./components/chess/singleplayer/MirrorChessBoard.tsx";
import ChessRouletteBoard from "./components/chess/singleplayer/ChessRouletteBoard.tsx";
import ChessHotPotatoBoard from "./components/chess/singleplayer/ChessHotPotatoBoard.tsx";
import ChessCollapseBoard from "./components/chess/singleplayer/ChessCollapse.tsx";
import { ChessSettingsProvider } from "./context/ChessSettingsContext";
import BossBattleBoard from "./components/chess/singleplayer/BossBattle.tsx";
import FourPlayerChess from "./components/chess/singleplayer/FourPlayerChess.tsx";
import RandomStartChess from "./components/chess/singleplayer/RandomStartChess.tsx";
import MirrorChessRules from "./components/chess/singleplayer/MirrorChessRules.tsx";
import ChessRouletteRules from "./components/chess/singleplayer/ChessRouletteRules.tsx";
import ChessHotPotatoRules from "./components/chess/singleplayer/ChessHotPotatoRules.tsx";
import ChessCollapseRules from "./components/chess/singleplayer/ChessCollapseRules.tsx";
import BossBattleRules from "./components/chess/singleplayer/BossBattleRules.tsx";
import TectonicChess from "./components/chess/singleplayer/TectonicChess.tsx";
import TectonicChessRules from "./components/chess/singleplayer/TectonicChessRules.tsx";
import TotalChaosChess from "./components/chess/singleplayer/TotalChaosChess.tsx";
import TotalChaosChessRules from "./components/chess/singleplayer/TotalChaosChessRules.tsx";
import {
  BossBattleAiPage,
  CapitalismAiPage,
  CollapseAiPage,
  DraftAiPage,
  FogOfWarAiPage,
  HorrorAiPage,
  HotPotatoAiPage,
  MirrorAiPage,
  MutationAiPage,
  PortalAiPage,
  RandomStartAiPage,
  RouletteAiPage,
  TectonicAiPage,
  ThreeLivesAiPage,
  TotalChaosAiPage,
} from "./components/chess/ai/AllVariantAiPages.tsx";
import FourPlayerAiPage from "./components/chess/ai/FourPlayerAiPage.tsx";
import {
  RandomStartMultiplayerGame,
  RandomStartMultiplayerLobby,
} from "./components/chess/multiplayer/RandomStartMultiplayer.tsx";
import {
  TotalChaosMultiplayerGame,
  TotalChaosMultiplayerLobby,
} from "./components/chess/multiplayer/TotalChaosMultiplayer.tsx";
import {
  DraftMultiplayerGame,
  DraftMultiplayerLobby,
} from "./components/chess/multiplayer/DraftMultiplayer.tsx";
import {
  FourPlayerMultiplayerGame,
  FourPlayerMultiplayerLobby,
} from "./components/chess/multiplayer/FourPlayerMultiplayer.tsx";
import {
  RouletteMultiplayerGame,
  RouletteMultiplayerLobby,
} from "./components/chess/multiplayer/RouletteMultiplayer.tsx";
import {
  ThreeLivesMultiplayerGame,
  ThreeLivesMultiplayerLobby,
} from "./components/chess/multiplayer/ThreeLivesMultiplayer.tsx";
import {
  MirrorMultiplayerGame,
  MirrorMultiplayerLobby,
} from "./components/chess/multiplayer/MirrorMultiplayer.tsx";
import {
  MutationMultiplayerGame,
  MutationMultiplayerLobby,
} from "./components/chess/multiplayer/MutationMultiplayer.tsx";
import {
  FogOfWarMultiplayerGame,
  FogOfWarMultiplayerLobby,
} from "./components/chess/multiplayer/FogOfWarMultiplayer.tsx";
import {
  TectonicMultiplayerGame,
  TectonicMultiplayerLobby,
} from "./components/chess/multiplayer/TectonicMultiplayer.tsx";
import {
  HotPotatoMultiplayerGame,
  HotPotatoMultiplayerLobby,
} from "./components/chess/multiplayer/HotPotatoMultiplayer.tsx";
import {
  CollapseMultiplayerGame,
  CollapseMultiplayerLobby,
} from "./components/chess/multiplayer/CollapseMultiplayer.tsx";
import {
  CapitalismMultiplayerGame,
  CapitalismMultiplayerLobby,
} from "./components/chess/multiplayer/CapitalismMultiplayer.tsx";
import {
  HorrorMultiplayerGame,
  HorrorMultiplayerLobby,
} from "./components/chess/multiplayer/HorrorMultiplayer.tsx";
import {
  BossBattleMultiplayerGame,
  BossBattleMultiplayerLobby,
} from "./components/chess/multiplayer/BossBattleMultiplayer.tsx";
import GamesPage from "./pages/general/GamesPage.tsx";
import ProfilePage from "./pages/social/ProfilePage.tsx";
import { WattenThreePlayerMultiplayerGame } from "./components/Watten/WattenThreePlayerMultiplayer.tsx";
import MedievalKingdomsWorldPage from "./pages/games/MedievalKingdoms/MedievalKingdomsWorldPage.tsx";
import MedievalKingdomsBattlePage from "./pages/games/MedievalKingdoms/MedievalKingdomsBattlePage.tsx";
import Chess3DAiPage from "./pages/games/Chess/Chess3DAiPage.tsx";
import Chess3DHotseatPage from "./pages/games/3DChess/Chess3DHotseatPage.tsx";
import Chess3DMenu from "./pages/games/3DChess/Chess3DMenu.tsx";
import CreditsPage from "./pages/general/CreditsPage.tsx";
import MedievalKingdomsRegionPage from "./pages/games/MedievalKingdoms/MedievalKingdomsRegionPage.tsx";
import LoginPage from "./pages/general/LoginPage.tsx";
import FriendsPage from "./pages/social/FriendsPage.tsx";
import NaturaMenu from "./pages/games/natura/naturaMenu.tsx";
import SchafKopfMenuPage from "./pages/schafkopf/SchafKopfMenuPage.tsx";
import SchafKopfLobbyPage from "./pages/schafkopf/SchafKopfLobbyPage.tsx";
import SchafkopfGame from "./components/Schafkopf/SchafkopfGame.tsx";
import SchafkopfMultiplayerGame from "./components/Schafkopf/SchafkopfMultiplayerGame.tsx";
import GoMenu from "./pages/games/Go/GoMenu.tsx";
import GoGamePage from "./pages/games/Go/GoGamePage.tsx";
import ShogiMenu from "./pages/games/Shogi/ShogiMenu.tsx";
import ShogiGamePage from "./pages/games/Shogi/ShogiGamePage.tsx";
import StrategyMultiplayer from "./components/strategy/StrategyMultiplayer.tsx";
import GoRules from "./components/strategy/GoRules.tsx";
import ShogiRules from "./components/strategy/ShogiRules.tsx";
const AtlasArenaPage = React.lazy(() => import("./pages/games/AtlasArena/AtlasArenaPage.tsx"));
const AtlasMultiplayerPage = React.lazy(() => import("./pages/games/AtlasArena/AtlasMultiplayerPage.tsx"));
const atlasPage = (page: React.ReactNode) => <React.Suspense fallback={<main className="min-h-[var(--app-height)] bg-[#06101f] p-10 text-zinc-400">Loading Atlas Arena…</main>}>{page}</React.Suspense>;

const router = createBrowserRouter([
  {
    element: <RootLayout />,

    children: [
      {
        path: "/",
        element: <LandingPage />,
      },

      {
        path: "/login",
        element: <LoginPage />,
      },

      {
        path: "/credits",
        element: <CreditsPage />,
      },
      {
        element: <AppLayout />,

        children: [
          {
            path: "/learn",
            element: <LearnPage />,
          },
          {
            path: "/dashboard",
            element: <App />,
          },
          {
            path: "/credits",
            element: <CreditsPage />,
          },

          {
            path: "/games",
            element: <GamesPage />,
          },
          { path: "/games/atlas-arena", element: atlasPage(<AtlasArenaPage />) },
          { path: "/games/atlas-arena/multiplayer", element: atlasPage(<AtlasMultiplayerPage />) },
          { path: "/games/atlas-arena/multiplayer/:roomCode", element: atlasPage(<AtlasMultiplayerPage />) },
          { path: "/games/go", element: <GoMenu /> },
          { path: "/games/go/rules", element: <GoRules /> },
          { path: "/games/go/ai", element: <GoGamePage mode="ai" /> },
          { path: "/games/go/hotseat", element: <GoGamePage mode="hotseat" /> },
          { path: "/games/go/multiplayer", element: <StrategyMultiplayer gameType="go" /> },
          { path: "/games/go/multiplayer/:roomCode", element: <StrategyMultiplayer gameType="go" /> },
          { path: "/games/shogi", element: <ShogiMenu /> },
          { path: "/games/shogi/rules", element: <ShogiRules /> },
          { path: "/games/shogi/ai", element: <ShogiGamePage mode="ai" /> },
          { path: "/games/shogi/hotseat", element: <ShogiGamePage mode="hotseat" /> },
          { path: "/games/shogi/multiplayer", element: <StrategyMultiplayer gameType="shogi" /> },
          { path: "/games/shogi/multiplayer/:roomCode", element: <StrategyMultiplayer gameType="shogi" /> },
          {
            path: "/profile",
            element: <ProfilePage />,
          },
          {
            path: "/friends",
            element: <FriendsPage />,
          },
          { path: "/groups", element: <GroupsPage /> },
          { path: "/leaderboards", element: <LeaderboardsPage /> },

          {
            path: "/games/chess",
            element: <ChessMenu />,
          },
          {
            path: "/games/natura",
            element: <NaturaMenu />,
          },

          {
            path: "/games/chess/classic",
            element: <ChessClassicMenu />,
          },
          {
            path: "/games/chess/classic/hotseat",
            element: <ChessGame />,
          },

          {
            path: "/games/watten",
            element: <Watten />,
          },
          { path: "/games/schafkopf", element: <SchafKopfMenuPage /> },
          {
            path: "/games/schafkopf/hotseat",
            element: <SchafkopfGame key="schafkopf-hotseat" mode="hotseat" />,
          },
          {
            path: "/games/schafkopf/ai",
            element: <SchafkopfGame key="schafkopf-ai" mode="ai" />,
          },
          {
            path: "/games/schafkopf/multiplayer",
            element: <SchafKopfLobbyPage />,
          },
          {
            path: "/games/schafkopf/multiplayer/:roomCode",
            element: <SchafkopfMultiplayerGame />,
          },

          {
            path: "/games/watten/hotseat",
            element: <WattenHotseat />,
          },

          {
            path: "/games/watten/hotseat/game",
            element: <WattenHotseatPage />,
          },
          { path: "/games/watten/singleplayer", element: <WattenSingleplayer /> },

          {
            path: "/games/watten/rules",
            element: <WattenRules />,
          },
          {
            path: "/games/watten/multiplayer",
            element: <WattenMultiplayerLobby />,
          },
          {
            path: "/games/watten/multiplayer/4/:roomCode",
            element: <WattenMultiplayerGame />,
          },
          {
            path: "/games/watten/multiplayer/3/:roomCode",
            element: <WattenThreePlayerMultiplayerGame />,
          },

          {
            path: "/games/chess/classic/ai",
            element: <ChessComputer />,
          },
          {
            path: "/games/chess/classic/multiplayer",
            element: <ChessMultiplayerModeMenu />,
          },
          {
            path: "/games/chess/classic/multiplayer/friends",
            element: <ChessMultiplayerLobby />,
          },
          {
            path: "/games/chess/classic/multiplayer/:roomCode",
            element: <ChessMultiplayerRoom />,
          },
          {
            path: "/games/chess/classic/multiplayer/:roomCode/game",
            element: <ChessMultiplayerGame />,
          },
          { path: "/games/chess/ranked", element: <ChessRankedLobby /> },
          { path: "/games/chess/ranked/:roomCode", element: <ChessMultiplayerRoom /> },
          { path: "/games/chess/ranked/:roomCode/game", element: <ChessMultiplayerGame /> },
          {
            path: "/games/chess/rules",
            element: <ChessRulesAndTips />,
          },
          {
            path: "/games/chess/puzzles",
            element: <ChessPuzzlesPage />,
          },
          {
            path: "/games/chess/audio",
            element: <ChessAudioSettings />,
          },
          {
            path: "/games/chess/variants",
            element: <ChessVariantsMenu />,
          },
          {
            path: "/games/chess/variants/three-lives/hotseat",
            element: <ThreeLivesChessBoard />,
          },
          {
            path: "/games/chess/variants/mutation/hotseat",
            element: <MutationChessBoard />,
          },
          {
            path: "/games/chess/variants/capitalism/hotseat",
            element: <CapitalismChessBoard />,
          },
          {
            path: "/games/chess/variants/capitalism/rules",
            element: <CapitalismChessRules />,
          },
          {
            path: "/games/chess/variants/horror/hotseat",
            element: <HorrorChessBoard />,
          },
          {
            path: "/games/chess/variants/horror/rules",
            element: <HorrorChessRules />,
          },
          {
            path: "/games/chess/variants/fogofwar/hotseat",
            element: <FogOfWarChessBoard />,
          },
          {
            path: "/games/chess/variants/fogofwar/rules",
            element: <FogOfWarChessRules />,
          },
          {
            path: "/games/chess/variants/draft/hotseat",
            element: <DraftChessBoard />,
          },
          {
            path: "/games/chess/variants/draft/rules",
            element: <DraftChessRules />,
          },
          {
            path: "/games/chess/variants/mirror/hotseat",
            element: <MirrorChessBoard />,
          },
          {
            path: "/games/chess/variants/mirror/rules",
            element: <MirrorChessRules />,
          },
          {
            path: "/games/chess/variants/roulette/hotseat",
            element: <ChessRouletteBoard />,
          },
          {
            path: "/games/chess/variants/roulette/rules",
            element: <ChessRouletteRules />,
          },
          {
            path: "/games/chess/variants/hotpotato/hotseat",
            element: <ChessHotPotatoBoard />,
          },
          {
            path: "/games/chess/variants/hotpotato/rules",
            element: <ChessHotPotatoRules />,
          },
          {
            path: "/games/chess/variants/collapse/hotseat",
            element: <ChessCollapseBoard />,
          },
          {
            path: "/games/chess/variants/collapse/rules",
            element: <ChessCollapseRules />,
          },
          {
            path: "/games/chess/variants/boss/hotseat",
            element: <BossBattleBoard />,
          },
          {
            path: "/games/chess/variants/boss/rules",
            element: <BossBattleRules />,
          },
          {
            path: "/games/chess/variants/4-players/hotseat",
            element: <FourPlayerChess />,
          },
          {
            path: "/games/chess/variants/randomstart/hotseat",
            element: <RandomStartChess />,
          },

          {
            path: "/games/chess/variants/tectonic/hotseat",
            element: <TectonicChess />,
          },
          {
            path: "/games/chess/variants/tectonic/rules",
            element: <TectonicChessRules />,
          },
          {
            path: "/games/chess/variants/complete-chaos/hotseat",
            element: <TotalChaosChess />,
          },
          {
            path: "/games/chess/variants/complete-chaos/rules",
            element: <TotalChaosChessRules />,
          },
          {
            path: "/games/chess/variants/complete-chaos/ai",
            element: <TotalChaosAiPage />,
          },
          {
            path: "/games/chess/variants/complete-chaos/multiplayer/:roomCode",
            element: <TotalChaosMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/complete-chaos/multiplayer",
            element: <TotalChaosMultiplayerLobby />,
          },

          {
            path: "/games/chess/variants/boss/ai",
            element: <BossBattleAiPage />,
          },
          {
            path: "/games/chess/variants/boss/multiplayer",
            element: <BossBattleMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/boss/multiplayer/:roomCode",
            element: <BossBattleMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/capitalism/ai",
            element: <CapitalismAiPage />,
          },
          {
            path: "/games/chess/variants/capitalism/multiplayer",
            element: <CapitalismMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/capitalism/multiplayer/:roomCode",
            element: <CapitalismMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/collapse/ai",
            element: <CollapseAiPage />,
          },
          {
            path: "/games/chess/variants/collapse/multiplayer",
            element: <CollapseMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/collapse/multiplayer/:roomCode",
            element: <CollapseMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/hotpotato/ai",
            element: <HotPotatoAiPage />,
          },
          {
            path: "/games/chess/variants/hot-potato/multiplayer",
            element: <HotPotatoMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/hot-potato/multiplayer/:roomCode",
            element: <HotPotatoMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/roulette/ai",
            element: <RouletteAiPage />,
          },
          {
            path: "/games/chess/variants/roulette/multiplayer/:roomCode",
            element: <RouletteMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/roulette/multiplayer",
            element: <RouletteMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/draft/ai",
            element: <DraftAiPage />,
          },
          {
            path: "/games/chess/variants/draft/multiplayer",
            element: <DraftMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/draft/multiplayer/:roomCode",
            element: <DraftMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/fogofwar/ai",
            element: <FogOfWarAiPage />,
          },
          {
            path: "/games/chess/variants/fog-of-war/multiplayer",
            element: <FogOfWarMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/fog-of-war/multiplayer/:roomCode",
            element: <FogOfWarMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/4-players/ai",
            element: <FourPlayerAiPage />,
          },
          {
            path: "/games/chess/variants/4-players/multiplayer/:roomCode",
            element: <FourPlayerMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/4-players/multiplayer",
            element: <FourPlayerMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/horror/ai",
            element: <HorrorAiPage />,
          },
          {
            path: "/games/chess/variants/horror/multiplayer",
            element: <HorrorMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/horror/multiplayer/:roomCode",
            element: <HorrorMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/mirror/ai",
            element: <MirrorAiPage />,
          },
          {
            path: "/games/chess/variants/mirror/multiplayer",
            element: <MirrorMultiplayerLobby />,
          },

          {
            path: "/games/chess/variants/mirror/multiplayer/:roomCode",
            element: <MirrorMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/portal/ai",
            element: <PortalAiPage />,
          },
          {
            path: "/games/chess/variants/randomstart/ai",
            element: <RandomStartAiPage />,
          },
          {
            path: "/games/chess/variants/randomstart/multiplayer",
            element: <RandomStartMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/randomstart/multiplayer/:roomCode",
            element: <RandomStartMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/tectonic/ai",
            element: <TectonicAiPage />,
          },

          {
            path: "/games/chess/variants/tectonic/multiplayer",
            element: <TectonicMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/tectonic/multiplayer/:roomCode",
            element: <TectonicMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/three-lives/ai",
            element: <ThreeLivesAiPage />,
          },
          {
            path: "/games/chess/variants/three-lives/multiplayer",
            element: <ThreeLivesMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/three-lives/multiplayer/:roomCode",
            element: <ThreeLivesMultiplayerGame />,
          },
          {
            path: "/games/chess/variants/mutation/ai",
            element: <MutationAiPage />,
          },
          {
            path: "/games/chess/variants/mutation/multiplayer",
            element: <MutationMultiplayerLobby />,
          },
          {
            path: "/games/chess/variants/mutation/multiplayer/:roomCode",
            element: <MutationMultiplayerGame />,
          },
          {
            path: "/games/medieval-kingdoms",
            element: <MedievalKingdomsWorldPage />,
          },
          {
            path: "/games/medieval-kingdoms/battle/:battleId",
            element: <MedievalKingdomsBattlePage />,
          },
          {
            path: "/games/medieval-kingdoms",
            element: <MedievalKingdomsWorldPage />,
          },
          {
            path: "/games/medieval-kingdoms/campaign/:campaignId",
            element: <MedievalKingdomsRegionPage />,
          },
          {
            path: "/games/medieval-kingdoms/campaign/:campaignId/battle/:battleNodeId",
            element: <MedievalKingdomsBattlePage />,
          },

          {
            path: "/games/chess/3dchess",
            element: <Chess3DMenu />,
          },
          {
            path: "/games/chess/3dchess/hotseat",
            element: <Chess3DHotseatPage />,
          },
          {
            path: "/games/chess/3dchess/ai",
            element: <Chess3DAiPage />,
          },
        ],
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

window.addEventListener("pointerdown", unlockChessAudio, { once: true });
window.addEventListener("keydown", unlockChessAudio, { once: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChessSettingsProvider>
      <ThemeProvider>
        <AuthProvider>
          <CardThemeProvider>
            <TableThemeProvider>
              <RouterProvider router={router} />
            </TableThemeProvider>
          </CardThemeProvider>
        </AuthProvider>
      </ThemeProvider>
    </ChessSettingsProvider>
  </React.StrictMode>,
);
