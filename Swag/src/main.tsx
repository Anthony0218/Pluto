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
        path: "/chess",
        element: <ChessMenu />,
      },      
      {
        path: "/chess/rules",
        element: <ChessRulesAndTips />,
      },
      {
        path: "/chess/classic",
        element: <ChessClassicMenu />,
      },
      {
        path: "/chess/classic/hotseat",
        element: <ChessGame />,
      },
      {
        path: "/chess/classic/ai",
        element: <ChessComputer />,
      },
      {
        path: "/chess/classic/multiplayer",
        element: <ChessMultiplayerLobby />,
      },
      {
        path: "/chess/classic/multiplayer/:roomCode",
        element: <ChessMultiplayerRoom />,
      },
      {
        path: "/chess/classic/multiplayer/:roomCode/game",
        element: <ChessMultiplayerGame />,
      },

      {
        path: "/chess/variants",
        element: <ChessVariantsMenu />,
      },
      {
        path: "/chess/variants/three-lives/hotseat",
        element: <ThreeLivesChessBoard />,
      },
      {
        path: "/chess/variants/mutation/hotseat",
        element: <MutationChessBoard />,
      },
      {
        path: "/chess/variants/chessmarket/hotseat",
        element: <CapitalismChessBoard />,
      },
      {
        path: "/chess/variants/chessmarket/rules",
        element: <CapitalismChessRules />,
      },
      {
        path: "/chess/variants/horror/hotseat",
        element: <HorrorChessBoard />,
      },
      {
        path: "/chess/variants/horror/rules",
        element: <HorrorChessRules />,
      },
      {
        path: "/chess/variants/fogofwar/hotseat",
        element: <FogOfWarChessBoard />,
      },
      {
        path: "/chess/variants/fogofwar/rules",
        element: <FogOfWarChessRules />,
      },
      {
        path: "/chess/variants/draft/hotseat",
        element: <DraftChessBoard />,
      },
      {
        path: "/chess/variants/draft/rules",
        element: <DraftChessRules />,
      },
      {
        path: "/chess/variants/mirror/hotseat",
        element: <MirrorChessBoard />,
      },
      {
        path: "/chess/variants/roulette/hotseat",
        element: <ChessRouletteBoard />,
      },
      {
        path: "/chess/variants/hotpotato/hotseat",
        element: <ChessHotPotatoBoard />,
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
        path: "/watten",
        element: <Watten />,
      },
      {
        path: "/watten/hotseat",
        element: <WattenHotseat />,
      },
      {
        path: "/watten/hotseat/game",
        element: <WattenHotseatPage />,
      },
      {
        path: "/watten/rules",
        element: <WattenRules />,
      },
      { 
        path: "/watten/multiplayer", 
        element: <WattenMultiplayerLobby /> 
      },
      {
        path: "/watten/multiplayer/:roomCode",
        element: <WattenMultiplayerRoom />,
      },
      {
        path: "/watten/multiplayer/:roomCode/game",
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
