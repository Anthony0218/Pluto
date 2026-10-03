import { recordCreatedGameInvite } from "@/components/social/GameInviteDelivery";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createRoom } from "@/games/cards/client/onlineRoom";
import { resolveSettings } from "@/games/cards/engine/GameEngine";
import type { GameDefinition, SettingValue } from "@/games/cards/engine/types";
import { Button, Field, NumberField, Panel } from "@/components/chessCustom/ui";
import SettingsForm from "../game/SettingsForm";

/** Host an online room for one published (cloud) version. */
export default function CreateRoomPanel({ def, versionId }: { def: GameDefinition; versionId: string | null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState(def.players.min);
  const [settings, setSettings] = useState<Record<string, SettingValue>>(() => resolveSettings(def));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(versionId!, players, settings);
      navigate(recordCreatedGameInvite(`/games/card-builder/room/${room.code}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the room.");
      setBusy(false);
    }
  };
  useInviteAutoCreate(() => host(), !!versionId);

  if (!user) {
    return (
      <Panel title="Play online" eyebrow="Online room">
        <p className="mb-3 text-sm text-zinc-400">Sign in to host a room your friends can join with a code.</p>
        <Link to="/login" className="inline-flex rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950">
          Sign in
        </Link>
      </Panel>
    );
  }
  if (!versionId) {
    return (
      <Panel title="Play online" eyebrow="Online room">
        <p className="text-sm text-zinc-400">Online rooms run a version published to your account. Templates and games saved only in this browser can be tested locally — save and publish this game while signed in to play it online.</p>
      </Panel>
    );
  }



  return (
    <Panel title="Host an online room" eyebrow="Online room">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Seats" hint={`Friends join with the room code. Seats still empty when you start are taken by bots (${def.players.min === def.players.max ? def.players.min : `${def.players.min}–${def.players.max}`} players).`}>
            <NumberField value={players} min={def.players.min} max={def.players.max} label="Seats" onChange={setPlayers} />
          </Field>
        </div>
        <div>{def.settings?.length ? <SettingsForm def={def} values={settings} onChange={setSettings} /> : <p className="text-sm text-zinc-500">This game has no lobby settings.</p>}</div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button tone="primary" disabled={busy} onClick={() => void host()}>
          <Globe2 size={16} /> {busy ? "Creating…" : "Create room"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
