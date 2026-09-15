import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";

import App from "./App";
import ChessGame from "./pages/ChessGames";
import Profile from "./pages/Profile";
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

const router = createBrowserRouter([
  {
    element: <AppLayout />,

    children: [
      {
        path: "/",
        element: <App />,
      },

      {
        path: "/chessGame",
        element: <ChessGame />,
      },

      {
        path: "/profile",
        element: <Profile />,
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
      { path: "/watten/multiplayer", element: <WattenMultiplayerLobby /> },
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
