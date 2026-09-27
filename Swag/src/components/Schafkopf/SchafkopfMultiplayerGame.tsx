import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { schafkopfRequest, type RoomSnapshot } from "../../games/schafkopf/multiplayer";
import type { Action } from "../../games/schafkopf/schafkopf";
import SchafkopfTable from "./SchafkopfTable";

export default function SchafkopfMultiplayerGame() {
  const { roomCode = "" } = useParams();
  const { user, loading } = useAuth();
  const code = roomCode.toUpperCase();
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const accept = useCallback((snapshot: RoomSnapshot | null) => {
    if (snapshot) setRoom(current => !current || snapshot.code !== current.code || snapshot.version >= current.version ? snapshot : current);
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const snapshot = await schafkopfRequest({ op: "get", code });
        if (!cancelled) { accept(snapshot); setConnectionError(null); }
      } catch (cause) {
        if (!cancelled) setConnectionError(cause instanceof Error ? cause.message : "Verbindung unterbrochen.");
      } finally { if (!cancelled) timer = setTimeout(refresh, 1500); }
    };
    void refresh();
    return () => { cancelled = true; mounted.current = false; clearTimeout(timer); };
  }, [code, user, accept]);

  async function send(op: "action" | "start" | "leave", action?: Action) {
    if (!room || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const request = op === "action" ? { op, code, version: room.version, action: action! } as const : { op, code, version: room.version };
      const snapshot = await schafkopfRequest(request);
      if (mounted.current) {
        if (op === "leave") navigate("/games/schafkopf/multiplayer");
        else accept(snapshot);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Aktion fehlgeschlagen.");
      // A stale version or a lost response is resolved by reading authoritative state.
      try { const snapshot = await schafkopfRequest({ op: "get", code }); if (mounted.current) accept(snapshot); } catch { /* polling retries */ }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { setError(`Bitte kopiere den Code manuell: ${code}`); }
  }
  if (loading) return <main className="sk-page">Anmeldung wird geladen …</main>;
  if (!user) return <main className="sk-page"><h1>Bitte anmelden</h1><Link className="sk-back" to="/login">Zur Anmeldung</Link></main>;
  if (!room || room.code !== code) return <main className="sk-page"><h1>Tisch {code}</h1><p>{connectionError ?? "Tisch wird geladen …"}</p><Link className="sk-back" to="/games/schafkopf/multiplayer">Zur Lobby / mit Code beitreten</Link></main>;
  const host = room.hostId === user.id;
  if (room.game) return <><div className="sk-connection"><span>Raum {code} · {connectionError ? "Verbindung wird wiederhergestellt …" : "Tisch verbunden"}</span><span>Bei Unterbrechung bleibt dein Platz erhalten. Öffne diesen Raum erneut.</span></div><SchafkopfTable view={room.game} onAction={action => void send("action", action)} busy={busy || Boolean(connectionError)} error={error ?? connectionError} allowNext={host} subtitle={`Online · Raum ${code}`} /></>;
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">Dein Schafkopf-Tisch</span><h1>Warte auf Mitspieler</h1><p>Teile den Code mit drei Freunden.</p></div><Link className="sk-button sk-secondary" to="/games/schafkopf">Menü</Link></header>
    <section className="sk-panel"><strong className="sk-room-code">{code}</strong><div className="sk-actions"><button className="sk-button sk-secondary" onClick={() => void copyCode()}>{copied ? "Kopiert" : "Code kopieren"}</button></div>
      <ul className="sk-waiting-list">{Array.from({ length: 4 }, (_, seat) => <li key={seat}>{seat + 1}. {room.players[seat]?.name ?? "Freier Platz"}{room.players[seat]?.id === room.hostId ? " · Gastgeber" : ""}{room.players[seat]?.id === user.id ? " · Du" : ""}</li>)}</ul>
      <div className="sk-actions">{host ? <button className="sk-button" disabled={busy || room.players.length !== 4 || Boolean(connectionError)} onClick={() => void send("start")}>Spiel starten ({room.players.length}/4)</button> : <p>Der Gastgeber startet, sobald alle vier Plätze besetzt sind.</p>}<button className="sk-button sk-secondary" disabled={busy} onClick={() => void send("leave")}>Tisch verlassen</button></div>
      <p>Nach Spielbeginn bleiben die Plätze reserviert. Unterbrochene Verbindungen können diesem Raum wieder beitreten.</p>
    </section>{(error || connectionError) && <p className="sk-error" role="alert">{error || connectionError}</p>}</main>;
}
