import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";

import App from "./App";
import GameList from "./pages/GameList";
import Profile from "./pages/Profile";
import ChessGame from "./pages/ChessGames";
import OnlineGame from "./pages/OnlineGame";
import OnlineGameRoom from "./pages/OnlineGameRoom";

import AppLayout from "./components/AppLayout";

import Watten from "./pages/Watten";
import WattenHotseat from "./pages/WattenHotseat";
import WattenHotseatPage from "./pages/WattenGamePage";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import WattenRules from "./pages/WattenRules";
import { CardThemeProvider } from "./context/CardThemeContext";
import { TableThemeProvider } from "./context/TableThemeContext";
import WattenMultiplayerLobby from "./components/WattenMultiplayerLobby";
import WattenMultiplayerRoom from "./components/WattenMultiplayerRoom";
import WattenMultiplayerGame from "./components/WattenMultiplayerGame";
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

const router = createBrowserRouter([
  {
    element: <AppLayout />,

    children: [
      {
        path: "/",
        element: <App />,
      },
      {
        path: "/profile",
        element: <Profile />,
      },
      {
        path: "/games",
        element: <GameList />
      },
      {
        path: "/games/chess",
        element: <ChessMenu />,
      },      
      {
        path: "/games/chess/rules",
        element: <ChessRulesAndTips />,
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
        path: "/games/chess/variants/chessmarket/hotseat",
        element: <CapitalismChessBoard />,
      },
      {
        path: "/games/chess/variants/chessmarket/rules",
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
        path: "/games/chess/variants/roulette/hotseat",
        element: <ChessRouletteBoard />,
      },
      {
        path: "/games/chess/variants/hotpotato/hotseat",
        element: <ChessHotPotatoBoard />,
      },


      {
        path: "/games/onlineGame",
        element: <OnlineGame />,
      },
      {
        path: "/games/onlineGame/:gameId",
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
        element: <WattenMultiplayerLobby /> 
      },
      {
        path: "/games/watten/multiplayer/:roomCode",
        element: <WattenMultiplayerRoom />,
      },
      {
        path: "/games/watten/multiplayer/:roomCode/game",
        element: <WattenMultiplayerGame />,
      },
      
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CardThemeProvider>
          <TableThemeProvider>
            <RouterProvider router={router} />
          </TableThemeProvider>
        </CardThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
