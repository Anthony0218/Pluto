import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import "./index.css";
import App from "./App";
import ChessGame from "./pages/ChessGames";
import { AuthProvider } from "./context/AuthContext";
import Profile from "./pages/Profile";
import OnlineGame from "./pages/OnlineGame";
import OnlineGameRoom from "./pages/OnlineGameRoom";
import AppLayout from "./components/AppLayout";
import WattenGamePage from "./pages/WattenGamePage";
import Watten from "./pages/Watten";
import WattenHotseat from "./pages/WattenHotseat";
import WattenGame from "./components/WattenGame";
import WattenHotseatPage from "./pages/WattenGamePage";

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
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
