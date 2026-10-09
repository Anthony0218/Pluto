import { DashboardDataProvider } from "@/context/DashboardDataContext";
import "../chess/chessLayout.css";
import ChessLayoutControls from "../chess/ChessLayoutControls";
import GameInviteDelivery from "../social/GameInviteDelivery";
import RoomFriends from "../social/RoomFriends";
import GlobalFriendsSidebar from "./GlobalFriendsSidebar";
import IncomingNotificationToasts from "./notifications/IncomingNotificationToasts";
import "./dashboard/dashboard.css";
import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ToolReminders from "../tools/ToolReminders";
import AccountActivity from "./AccountActivity";
import PublicHeader from "./PublicHeader";
import { useTheme } from "../../context/ThemeContext";

export default function RootLayout() {
  return <DashboardDataProvider><RootContent /></DashboardDataProvider>;
}

function RootContent() {
  const location = useLocation();
  const { passwordRecovery } = useAuth();
  const fullHeader = location.pathname === "/" || location.pathname === "/home" || location.pathname === "/dashboard";
  const integratedNavigation = location.pathname === "/games/chess" || location.pathname.startsWith("/games/chess/") || location.pathname === "/chess-custom" || location.pathname.startsWith("/chess-custom/");
  const viewport = useRef<HTMLDivElement>(null);
  const { plutoMode } = useTheme();
  // Accepting an invite remounts the page, so an open lobby joins the invited room rather than keeping its old code.
  const inviteStamp = (location.state as { inviteRemount?: number } | null)?.inviteRemount;
  const [seenInvite, setSeenInvite] = useState(inviteStamp);
  const [pageGeneration, setPageGeneration] = useState(0);
  if (inviteStamp !== undefined && inviteStamp !== seenInvite) { setSeenInvite(inviteStamp); setPageGeneration(generation => generation + 1); }
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
      else viewport.current?.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  // Query parameters select in-page tabs, dates and historical editions (including
  // tools embedded on the landing page). Only page/anchor navigation resets scroll.
  }, [location.pathname, location.hash]);

  return <div className={"app-shell w-full text-zinc-100 " + (integratedNavigation ? "integrated-navigation " : "") + (plutoMode ? "bg-[#060816]" : "bg-zinc-950")} data-app-theme={plutoMode ? "pluto" : "black"}>
    <AccountActivity />
    <ToolReminders />
    {!integratedNavigation && <PublicHeader compact={!fullHeader} />}
    <div ref={viewport} className="app-viewport">
      {passwordRecovery && location.pathname !== "/reset-password" ? <Navigate to="/reset-password" replace /> : <Outlet key={pageGeneration} />}
    </div>
    <RoomFriends />
    <GlobalFriendsSidebar key={location.pathname} />
    <GameInviteDelivery />
    <ChessLayoutControls />
    <IncomingNotificationToasts />
  </div>;
}
