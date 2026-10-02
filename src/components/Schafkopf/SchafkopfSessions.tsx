import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { schafkopfRequest, type SessionSummary } from "../../games/schafkopf/multiplayer";

export default function SchafkopfSessions({ refreshKey = 0, currentCode, onNew }: { refreshKey?: number; currentCode?: string; onNew?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    schafkopfRequest({ op: "list" }).then(items => {
      if (!cancelled) { setSessions(items); setError(null); setLoading(false); }
    }).catch(cause => {
      if (!cancelled) { setError(cause instanceof Error ? cause.message : "Spieltage konnten nicht geladen werden."); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [user, refreshKey]);
  async function remove(session: SessionSummary) {
    if (!user) return;
    const owner = session.hostId === user.id;
    const question = owner
      ? `„${session.title}“ für alle Teilnehmer endgültig löschen?`
      : `„${session.title}“ aus deiner Liste entfernen? Der Tisch bleibt für die anderen erhalten.`;
    if (!window.confirm(question)) return;
    setDeleting(session.code); setError(null);
    try {
      await schafkopfRequest({ op: "delete", code: session.code, version: session.version });
      setSessions(current => current.filter(item => item.code !== session.code));
      if (session.code === currentCode) navigate("/games/schafkopf/multiplayer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Spieltag konnte nicht entfernt werden.");
      try { setSessions(await schafkopfRequest({ op: "list" })); } catch { /* Show the original error. */ }
    } finally { setDeleting(null); }
  }
  if (!user) return <p>Melde dich an, um deine gespeicherten Spieltage zu sehen.</p>;
  return <section className="sk-sessions" aria-label="Gespeicherte Spieltage">
    <div className="sk-sessions-heading"><div><h3>Deine Spieltage</h3><p>Online-Runden und KI-Besetzungen werden automatisch in deinem Konto gespeichert.</p></div>{onNew ? <button type="button" className="sk-button sk-secondary" onClick={onNew}>Neuer Spieltag</button> : <Link className="sk-button sk-secondary" to="/games/schafkopf/multiplayer">Neuer Spieltag</Link>}</div>
    {loading ? <p>Spieltage werden geladen …</p> : sessions.length === 0 ? <p>Noch kein Spieltag gespeichert. Erstelle einen neuen Tisch.</p> : <ul className="sk-session-list">{sessions.map(session => { const seated = session.players.some(player => player.id === user.id); return <li key={session.code} className="sk-session-item">
      <div className="sk-session-main"><strong>{session.title}</strong><small>{new Date(session.updatedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} · {session.round ? `Runde ${session.round}` : "Wartetisch"} · {session.code}</small><span>{session.players.map(player => `${player.name}${player.bot ? " (KI)" : ""}`).join(" · ")}{session.players.length < 4 ? ` · ${4 - session.players.length} freie Plätze` : ""}</span></div>
      {session.totals && <div className="sk-session-scores" aria-label="Spielstände in Cent">{session.players.map((player, seat) => <span key={player.id}>{player.name}: <strong>{session.pendingSeats?.includes(seat) ? 0 : session.totals?.[seat] ?? 0} Cent</strong>{session.pendingSeats?.includes(seat) ? " (ab nächster Runde)" : ""}</span>)}{session.formerPlayers?.map((player, index) => <span key={`${player.id}-${index}`}>{player.name}: <strong>{player.total} Cent</strong> (bis Runde {player.round})</span>)}</div>}
      <div className="sk-session-actions"><Link className="sk-button sk-secondary" to={seated ? `/games/schafkopf/multiplayer/${session.code}` : "/games/schafkopf/multiplayer"}>{seated ? "Öffnen" : "Erneut beitreten"}</Link><button type="button" className="sk-button sk-danger" disabled={deleting === session.code} onClick={() => void remove(session)}>{session.hostId === user.id ? "Löschen" : "Aus Liste entfernen"}</button></div>
    </li>; })}</ul>}
    {error && <p className="sk-error" role="alert">{error}</p>}
  </section>;
}
