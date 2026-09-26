import "../chess/chessLayout.css";
import ChessLayoutControls from "../chess/ChessLayoutControls";
import RoomFriends from "../social/RoomFriends";
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import AccountActivity from "./AccountActivity";
import NavigationDrawer from "./NavigationDrawer";
import PublicHeader from "./PublicHeader";
import { useTheme } from "../../context/ThemeContext";

export default function RootLayout() {
  const location = useLocation();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const navigationOpen = openAt === location.key;
  const { plutoMode } = useTheme();

  return (
    <div
      className={`
        min-h-screen
        w-full
        text-zinc-100
        ${plutoMode ? "bg-[#060816]" : "bg-zinc-950"}
      `}
    >
      {/* GLOBAL HEADER */}
      <AccountActivity />
      <PublicHeader
        key={location.key}
        navigationOpen={navigationOpen}
        onToggleNavigation={() =>
          setOpenAt(navigationOpen ? null : location.key)
        }
      />
      {navigationOpen && <NavigationDrawer onClose={() => setOpenAt(null)} />}

      {/* 
        PublicHeader is fixed and h-16 = 64px.
        Everything below therefore starts after 64px.
      */}
      <div
        className="
          min-h-[calc(100vh-4rem)]
          pt-16
        "
      >
        <Outlet />
        <RoomFriends />
        <ChessLayoutControls />
      </div>
    </div>
  );
}
