import { DashboardDataProvider } from "@/context/DashboardDataContext";
import "../chess/chessLayout.css";
import ChessLayoutControls from "../chess/ChessLayoutControls";
import RoomFriends from "../social/RoomFriends";
import GlobalFriendsSidebar from "./GlobalFriendsSidebar";
import "./dashboard/dashboard.css";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AccountActivity from "./AccountActivity";
import PublicHeader from "./PublicHeader";
import { useTheme } from "../../context/ThemeContext";

export default function RootLayout() {
  return <DashboardDataProvider><RootContent /></DashboardDataProvider>;
}

function RootContent() {
  const location = useLocation();
  const fullHeader = location.pathname === "/" || location.pathname === "/dashboard";
  const integratedNavigation = location.pathname === "/games/chess" || location.pathname.startsWith("/games/chess/");
  const viewport = useRef<HTMLDivElement>(null);
  const { plutoMode } = useTheme();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
      else viewport.current?.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash]);

  return <div className={"app-shell w-full text-zinc-100 " + (integratedNavigation ? "integrated-navigation " : "") + (plutoMode ? "bg-[#060816]" : "bg-zinc-950")} data-app-theme={plutoMode ? "pluto" : "black"}>
    <AccountActivity />
    {!integratedNavigation && <PublicHeader compact={!fullHeader} />}
    <div ref={viewport} className="app-viewport">
      <Outlet />
    </div>
    <RoomFriends />
    {location.pathname !== "/dashboard" && <GlobalFriendsSidebar key={location.pathname} />}
    <ChessLayoutControls />
  </div>;
}
