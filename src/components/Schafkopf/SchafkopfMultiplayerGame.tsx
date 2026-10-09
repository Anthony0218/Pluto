import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { schafkopfRequest, type RoomSnapshot } from "../../games/schafkopf/multiplayer";
import { AI_DIFFICULTY_OPTIONS, type Action, type AiDifficulty, type GameRules } from "../../games/schafkopf/schafkopf";
import { savedSchafkopfRules } from "./schafkopfRulesPreference";
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
  const titleRef = useRef<HTMLInputElement>(null);
  const difficultyRef = useRef<HTMLSelectElement>(null);
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

  async function send(op: "action" | "start" | "leave" | "rules" | "configure" | "replace" | "vacate" | "timing", action?: Action, rules?: GameRules, replacement?: { seat: number; bot: boolean }, collectSeconds?: number) {
    if (!room || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      let request;
      if (op === "action") request = { op, code, version: room.version, action: action! } as const;
      else if (op === "rules") request = { op, code, version: room.version, rules: rules! } as const;
      else if (op === "replace") request = { op, code, version: room.version, seat: replacement!.seat, bot: replacement!.bot } as const;
      else if (op === "vacate") request = { op, code, version: room.version, seat: replacement!.seat } as const;
      else if (op === "timing") request = { op, code, version: room.version, collectSeconds: collectSeconds! } as const;
      else if (op === "configure") request = { op, code, version: room.version, title: titleRef.current?.value ?? room.title, aiDifficulty: (difficultyRef.current?.value ?? room.aiDifficulty) as AiDifficulty } as const;
      else if (op === "start") {
        const saved = savedSchafkopfRules();
        request = { op, code, version: room.version, rules: saved, title: titleRef.current?.value ?? room.title, aiDifficulty: (difficultyRef.current?.value ?? room.aiDifficulty) as AiDifficulty } as const;
      } else request = { op, code, version: room.version } as const;
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
  async function saveAvatar(avatar: number, name: string): Promise<boolean> {
    if (!room || inFlight.current) return false;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const snapshot = await schafkopfRequest({ op: "avatar", code, version: room.version, avatar, name });
      if (mounted.current) accept(snapshot);
      try { localStorage.setItem(`schafkopf-own-avatar-${user?.id}`, String(avatar)); } catch { /* Server selection stays active. */ }
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Avatar konnte nicht gespeichert werden.");
      return false;
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function changeDifficulty(aiDifficulty: AiDifficulty) {
    if (!room || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try { const snapshot = await schafkopfRequest({ op: "difficulty", code, version: room.version, aiDifficulty }); if (mounted.current) accept(snapshot); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "Bot-Stufe konnte nicht gespeichert werden."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { setError(`Bitte kopiere den Code manuell: ${code}`); }
  }
  if (loading) return <main className="sk-page">Anmeldung wird geladen …</main>;
  if (!user) return <main className="sk-page"><h1>Bitte anmelden</h1><Link className="sk-back" to="/login">Zur Anmeldung</Link></main>;
  if (!room || room.code !== code) return <main className="sk-page"><h1>Tisch {code}</h1><p>{connectionError ?? "Tisch wird geladen …"}</p><Link className="sk-back" to="/games/schafkopf/multiplayer">Zur Lobby / mit Code beitreten</Link></main>;
  const host = room.hostId === user.id;
  if (room.game) {
    const betweenGames = room.game.phase === "finished" || room.game.phase === "redeal";
    return <>
      <div className="sk-connection">
        <span>{room.title} · Raum {code} · {connectionError ? "Verbindung wird wiederhergestellt …" : "Tisch verbunden"}</span>
        <span>Bei Unterbrechung bleibt dein Platz erhalten. Öffne diesen Raum erneut.</span>
        {(host || room.players[room.game.seat]?.bot) && <details className="sk-backup-settings"><summary>KI-Ersatz verwalten</summary><div>{room.players.map((player, seat) => !player.id.startsWith("bot:") && (host || (player.id === user.id && player.bot)) ? <button key={player.id} type="button" className="sk-button sk-secondary" disabled={busy || Boolean(connectionError)} onClick={() => void send("replace", undefined, undefined, { seat, bot: !player.bot })}>{player.bot ? `${player.name} wieder übernehmen` : `KI für ${player.name}`}</button> : null)}</div></details>}
        {betweenGames && <div className="sk-seat-manager"><strong>Besetzung für die nächste Runde</strong><p>Der Gastgeber kann Mitspieler freigeben. Ein freier KI-Platz kann mit dem Raumcode von einem anderen Konto übernommen werden. Neue Spieler beginnen bei 0 Cent; bisherige Ergebnisse bleiben gespeichert.</p><div className="sk-seat-manager-list">{room.players.map((player, seat) => <div key={seat}><span>Platz {seat + 1}: {player.name}{player.id.startsWith("bot:") ? " · frei für Mitspieler" : player.bot ? " · KI-Ersatz aktiv" : ""}{room.pendingSeats?.includes(seat) ? " · ab nächster Runde" : ""}</span>{host && seat > 0 && !player.id.startsWith("bot:") && <button type="button" className="sk-button sk-secondary" disabled={busy || Boolean(connectionError)} onClick={() => void send("vacate", undefined, undefined, { seat, bot: true })}>Platz freigeben</button>}</div>)}</div><button type="button" className="sk-button sk-secondary" onClick={() => void copyCode()}>{copied ? "Code kopiert" : `Code ${code} kopieren`}</button></div>}
      </div>
      <SchafkopfTable view={room.game} onAction={action => void send("action", action)} onRulesChange={host ? rules => void send("rules", undefined, rules) : undefined} busy={busy || Boolean(connectionError) || Boolean(room.players[room.game.seat]?.bot)} error={error ?? connectionError} allowNext={host} subtitle={`Online · ${room.title}`} onlineSession onlineCode={code} hasBots={room.players.some(player => player.bot)} playerAvatars={room.players.map(player => player.avatar)} onAvatarSave={saveAvatar} onAiDifficultyChange={host ? difficulty => void changeDifficulty(difficulty) : undefined} aiDifficulty={room.aiDifficulty} collectSecondsValue={room.collectSeconds} onCollectSecondsChange={host ? seconds => send("timing", undefined, undefined, undefined, seconds) : undefined} />
    </>;
  }
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">Dein Schafkopf-Tisch</span><h1>{room.title}</h1><p>Teile den Code mit Freunden oder starte mit KI auf den freien Plätzen.</p></div><Link className="sk-button sk-secondary" to="/games/schafkopf/multiplayer">Spieltage</Link></header>
    <section className="sk-panel"><strong className="sk-room-code">{code}</strong><div className="sk-actions"><button className="sk-button sk-secondary" onClick={() => void copyCode()}>{copied ? "Kopiert" : "Code kopieren"}</button></div>
      <ul className="sk-waiting-list">{Array.from({ length: 4 }, (_, seat) => <li key={seat}>{seat + 1}. {room.players[seat]?.name ?? "Freier Platz · wird beim Start KI"}{room.players[seat]?.id === room.hostId ? " · Gastgeber" : ""}{room.players[seat]?.id === user.id ? " · Du" : ""}</li>)}</ul>
      {host && <div className="sk-waiting-settings"><label className="sk-lobby-field" htmlFor="sk-room-title">Spieltag<input ref={titleRef} id="sk-room-title" defaultValue={room.title} maxLength={60} /></label><label className="sk-lobby-field" htmlFor="sk-room-ai">KI-Spielstärke<select ref={difficultyRef} id="sk-room-ai" defaultValue={room.aiDifficulty === "normal" ? "amateur" : room.aiDifficulty}>{AI_DIFFICULTY_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button className="sk-button sk-secondary" disabled={busy || Boolean(connectionError)} onClick={() => void send("configure")}>Einstellungen speichern</button></div>}
      <div className="sk-actions">{host ? <button className="sk-button" disabled={busy || Boolean(connectionError)} onClick={() => void send("start")}>Spiel starten · {room.players.length} Mensch{room.players.length === 1 ? "" : "en"}, {4 - room.players.length} KI</button> : <p>Der Gastgeber startet, wenn alle gewünschten Menschen beigetreten sind.</p>}<button className="sk-button sk-secondary" disabled={busy} onClick={() => void send("leave")}>Tisch verlassen</button></div>
      <p>Nach Spielbeginn bleiben die Plätze reserviert. Unterbrochene Verbindungen können diesem Raum wieder beitreten.</p>
    </section>{(error || connectionError) && <p className="sk-error" role="alert">{error || connectionError}</p>}</main>;
}
