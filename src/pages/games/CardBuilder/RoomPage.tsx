import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { normalizeRoomCode, ROOM_CODE } from "@/games/cards/rooms";
import OnlineRoom from "@/components/cardBuilder/online/OnlineRoom";
import { Button, Panel, inputClass } from "@/components/chessCustom/ui";
import CardBuilderLayout from "./CardBuilderLayout";

/** Enter a room code (or arrive with one from an invite link). */
export function JoinRoomForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (ROOM_CODE.test(code)) navigate(`/games/card-builder/room/${code}`);
      }}
    >
      <input aria-label="Room code" placeholder="ROOM CODE" className={`${inputClass} w-40 font-mono tracking-[0.25em]`} value={code} onChange={(event) => setCode(normalizeRoomCode(event.target.value))} />
      <Button type="submit" tone="blue" size="sm" disabled={!ROOM_CODE.test(code)}>
        <LogIn size={14} /> Join room
      </Button>
    </form>
  );
}

/** `/games/card-builder/room/:code` — an online room. */
export default function RoomPage() {
  const { user, loading } = useAuth();
  const params = useParams();
  const code = normalizeRoomCode(params.code ?? "");
  const valid = ROOM_CODE.test(code);
  return (
    <CardBuilderLayout crumbs={[{ label: valid ? `Room ${code}` : "Join a room" }]}>
      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {!loading && !user && (
        <Panel title="Sign in to play online" eyebrow="Online room">
          <p className="mb-3 text-sm text-zinc-400">Rooms run on the server so every player sees the same game — sign in to take a seat.</p>
          <Link to="/login" className="inline-flex rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950">
            Sign in
          </Link>
        </Panel>
      )}
      {!loading && user && valid && <OnlineRoom key={code} code={code} />}
      {!loading && user && !valid && (
        <Panel title="Join a room" eyebrow="Online room">
          <p className="mb-3 text-sm text-zinc-400">Enter the six-character code the host shared.</p>
          <JoinRoomForm />
        </Panel>
      )}
    </CardBuilderLayout>
  );
}
