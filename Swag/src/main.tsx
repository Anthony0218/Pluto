import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";

import App from "./App";
import ChessGame from "./pages/ChessGames";
import OnlineGame from "./pages/OnlineGame";
import OnlineGameRoom from "./pages/OnlineGameRoom";

import AppLayout from "./components/AppLayout";
import NotFoundPage from "./pages/NotFoundPage";
import Watten from "./pages/Watten";
import WattenHotseat from "./pages/WattenHotseat";
import WattenHotseatPage from "./pages/WattenGamePage";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import WattenRules from "./pages/WattenRules";
import { CardThemeProvider } from "./context/CardThemeContext";
import { TableThemeProvider } from "./context/TableThemeContext";
import WattenMultiplayerLobby from "./components/WattenMultiplayerLobby";
import WattenMultiplayerGame from "./components/WattenMultiplayerGame.tsx";
import ChessClassicMenu from "./pages/ChessClassicalMenu";
import ChessMenu from "./pages/ChessMenu";
import ChessComputer from "./pages/ChessComputer";
import ChessMultiplayerLobby from "./pages/ChessMultiplayerLobby";
import ChessMultiplayerRoom from "./pages/ChessMultiplayerRoom";
import ChessMultiplayerGame from "./pages/ChessMultiplayerGame";
import ChessRulesAndTips from "./components/ChessRulesAndTips";
import ChessVariantsMenu from "./pages/ChessVariantsMenu";
import ThreeLivesChessBoard from "./components/ThreeLivesChessBoard";
import MutationChessBoard from "./components/MutationChessBoard";
import CapitalismChessBoard from "./components/CapitalismChessBoard";
import CapitalismChessRules from "./components/CapitalismChessRules";
import HorrorChessRules from "./components/HorrorChessRules";
import HorrorChessBoard from "./components/HorrorChessBoard";
import FogOfWarChessBoard from "./components/FogOfWarChessBoard";
import FogOfWarChessRules from "./components/FogOfWarChessRules";
import DraftChessBoard from "./components/DraftChessBoard";
import DraftChessRules from "./components/DraftChessRules";
import MirrorChessBoard from "./components/MirrorChessBoard";
import ChessRouletteBoard from "./components/ChessRouletteBoard";
import ChessHotPotatoBoard from "./components/ChessHotPotatoBoard";
import ChessCollapseBoard from "./components/ChessCollapse";
import { ChessSettingsProvider } from "./context/ChessSettingsContext";
import BossBattleBoard from "./components/BossBattle";
import FourPlayerChess from "./components/FourPlayerChess";
import RandomStartChess from "./components/RandomStartChess";
import MirrorChessRules from "./components/MirrorChessRules";
import ChessRouletteRules from "./components/ChessRouletteRules";
import ChessHotPotatoRules from "./components/ChessHotPotatoRules";
import ChessCollapseRules from "./components/ChessCollapseRules";
import BossBattleRules from "./components/BossBattleRules";
import TectonicChess from "./components/TectonicChess";
import TectonicChessRules from "./components/TectonicChessRules";
import TotalChaosChess from "./components/TotalChaosChess";
import TotalChaosChessRules from "./components/TotalChaosChessRules";
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
} from "./components/ai/AllVariantAiPages";
import FourPlayerAiPage from "./components/ai/FourPlayerAiPage";
import {
  RandomStartMultiplayerGame,
  RandomStartMultiplayerLobby,
} from "./components/multiplayer/RandomStartMultiplayer";
import {
  TotalChaosMultiplayerGame,
  TotalChaosMultiplayerLobby,
} from "./components/multiplayer/TotalChaosMultiplayer";
import {
  DraftMultiplayerGame,
  DraftMultiplayerLobby,
} from "./components/multiplayer/DraftMultiplayer";
import {
  FourPlayerMultiplayerGame,
  FourPlayerMultiplayerLobby,
} from "./components/multiplayer/FourPlayerMultiplayer";
import {
  RouletteMultiplayerGame,
  RouletteMultiplayerLobby,
} from "./components/multiplayer/RouletteMultiplayer";
import {
  ThreeLivesMultiplayerGame,
  ThreeLivesMultiplayerLobby,
} from "./components/multiplayer/ThreeLivesMultiplayer";
import {
  MirrorMultiplayerGame,
  MirrorMultiplayerLobby,
} from "./components/multiplayer/MirrorMultiplayer";
import {
  MutationMultiplayerGame,
  MutationMultiplayerLobby,
} from "./components/multiplayer/MutationMultiplayer";
import {
  FogOfWarMultiplayerGame,
  FogOfWarMultiplayerLobby,
} from "./components/multiplayer/FogOfWarMultiplayer.tsx";
import {
  TectonicMultiplayerGame,
  TectonicMultiplayerLobby,
} from "./components/multiplayer/TectonicMultiplayer.tsx";
import {
  HotPotatoMultiplayerGame,
  HotPotatoMultiplayerLobby,
} from "./components/multiplayer/HotPotatoMultiplayer.tsx";
import {
  CollapseMultiplayerGame,
  CollapseMultiplayerLobby,
} from "./components/multiplayer/CollapseMultiplayer.tsx";
import {
  CapitalismMultiplayerGame,
  CapitalismMultiplayerLobby,
} from "./components/multiplayer/CapitalismMultiplayer.tsx";
import {
  HorrorMultiplayerGame,
  HorrorMultiplayerLobby,
} from "./components/multiplayer/HorrorMultiplayer.tsx";
import {
  BossBattleMultiplayerGame,
  BossBattleMultiplayerLobby,
} from "./components/multiplayer/BossBattleMultiplayer.tsx";
import GamesPage from "./pages/GamesPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import { WattenThreePlayerMultiplayerGame } from "./components/WattenThreePlayerMultiplayer.tsx";
import MedievalKingdomsWorldPage from "./pages/MedievalKingdoms/MedievalKingdomsWorldPage.tsx";
import MedievalKingdomsBattlePage from "./pages/MedievalKingdoms/MedievalKingdomsBattlePage.tsx";

const router = createBrowserRouter([
  {
    element: <AppLayout />,

    children: [
      {
        path: "/",
        element: <App />,
      },
      {
        path: "/games",
        element: <GamesPage />,
      },
      {
        path: "/profile",
        element: <ProfilePage />,
      },

      {
        path: "/games/chess",
        element: <ChessMenu />,
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
        path: "/onlineGame",
        element: <OnlineGame />,
      },

      {
        path: "/onlineGame/:gameId",
        element: <OnlineGameRoom />,
      },

      {
        path: "/games/watten",
        element: <Watten />,
      },

      {
        path: "/games/watten/hotseat",
        element: <WattenHotseat />,
      },

      {
        path: "/games/watten/hotseat/game",
        element: <WattenHotseatPage />,
      },

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
      {
        path: "/games/chess/rules",
        element: <ChessRulesAndTips />,
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
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

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
