import { useState, type ContextType } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { AuthContext, type AuthContextType } from "../src/context/authState";
import { DashboardDataContext } from "../src/hooks/useDashboardData";
import GameInvitePanel from "../src/components/social/GameInvitePanel";
import ClanInvitePanel from "../src/components/social/ClanInvitePanel";
import RoomFriends from "../src/components/social/RoomFriends";
import PartyLobby from "../src/pages/games/Party/PartyLobby";
import type { PartyConnection } from "../src/games/party/network/usePartyConnection";
import { createPlayer } from "../src/games/party/engine/engine";
import { DEFAULT_SETTINGS } from "../src/games/party/config";
import type { Lobby } from "../src/games/party/types";
import "../src/index.css";
import "../src/pages/games/Party/party.css";

// Isolated account data: opening an invite dialog never signs into a real account.
const auth: AuthContextType = {
  user: { id: "preview-user" } as User, profile: null, loading: false,
  passwordRecovery: false, finishPasswordRecovery() {}, refreshProfile: async () => {},
  signUp: async () => ({ error: null, needsEmailConfirmation: false }),
  signIn: async () => ({ error: null }), updateProfile: async () => ({ error: null }), signOut: async () => {},
};
const dashboard = {
  friends: [], onlineIds: [], loading: false, friendsError: false,
  clans: [{ id: "preview-clan", name: "Moon crew", avatar_id: "m1" }],
} as unknown as NonNullable<ContextType<typeof DashboardDataContext>>;
const lobby: Lobby = {
  code: "PLUTO-123456", name: "Friends party", hostId: "preview-user", public: false,
  settings: { ...DEFAULT_SETTINGS }, players: [createPlayer("preview-user", "You", 0)], match: null,
};
const connection = { status: "online", playerId: "preview-user", pending: null, serverOffset: 0, send() {} } as unknown as PartyConnection;

export function Preview() {
  const [view, setView] = useState("pickers");
  return <AuthContext.Provider value={auth}><DashboardDataContext.Provider value={dashboard}><MemoryRouter>
    <main style={{ minHeight: "100vh", background: "#091019", color: "white", padding: 20 }}>
      <nav style={{ display: "flex", gap: 20, marginBottom: 20 }}><button onClick={() => setView("pickers")}>Invitation pickers</button><button onClick={() => setView("party")}>Party open seats</button></nav>
      {view === "pickers" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: 20, maxWidth: 1100 }}>
        <GameInvitePanel /><ClanInvitePanel />
      </div> : <div className="pp-page"><PartyLobby lobby={lobby} connection={connection} /></div>}
    </main><RoomFriends />
  </MemoryRouter></DashboardDataContext.Provider></AuthContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
