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
import WattenMultiplayer from "./pages/WattenMultiplayer";
import WattenMultiplayerGame from "./pages/WattenMultiplayerGame";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

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
        path: "/watten/multiplayer",
        element: <WattenMultiplayer />,
      },

      {
        path: "/watten/multiplayer/:gameId",
        element: <WattenMultiplayerGame />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
