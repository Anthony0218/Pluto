import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Trash2, Upload } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import GoGameReview from "../../../components/strategy/GoGameReview";
import { deleteSavedGoGame, listSavedGoGames, loadGoGame, saveGoRecord, type SavedGoGame } from "../../../games/go/storage";
import { claimLocalGoGames, deleteCloudGoGame, refreshGoLibrary, uploadGoRecord } from "../../../games/go/cloudStorage";
import { exportGoSgf, importGoSgf } from "../../../games/go/sgf";
import { canReviewGoGame } from "../../../games/go/reviewAvailability";

export default function GoAnalysisPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  const [params] = useSearchParams();
  const [saved, setSaved] = useState(() => listSavedGoGames(userId));
  const [message, setMessage] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(() => !params.get("game"));
  useEffect(() => {
    const timer = window.setTimeout(() => setSaved(listSavedGoGames(userId)), 0);
    if (!userId) return () => window.clearTimeout(timer);
    let active = true;
    void refreshGoLibrary(userId).then(records => { if (active) setSaved(records); }).catch(error => { if (active) setMessage(error instanceof Error ? `Account sync unavailable: ${error.message}` : "Account sync unavailable."); });
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId]);
  const visibleSaved = saved.filter(record => !record.ownerId || record.ownerId === userId);
  const selected = visibleSaved.find(record => record.id === params.get("game"));
  const latest = loadGoGame();
  const game = selected?.game ?? (!params.get("game") && canReviewGoGame(latest) ? latest : null);
  function showReview() {
    setLibraryOpen(false);
    window.scrollTo(0, 0);
  }
  async function remove(record: SavedGoGame) {
    if (!window.confirm("Delete this saved Go game?")) return;
    try {
      if (user && record.ownerId === user.id) await deleteCloudGoGame(record.id, user.id);
      deleteSavedGoGame(record.id);
      setSaved(listSavedGoGames(user?.id));
      if (params.get("game") === record.id) navigate("/games/go/analysis", { replace: true });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete this game."); }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = importGoSgf(await file.text());
      const record = saveGoRecord(imported.game, { mode: "imported", players: imported.players }, imported.savedAt, user?.id);
      setSaved(listSavedGoGames(user?.id));
      showReview();
      navigate(`/games/go/analysis?game=${encodeURIComponent(record.id)}`);
      setMessage("SGF main line imported. Comments and alternate variations are not shown.");
      if (user) void uploadGoRecord(record, user.id).catch(() => setMessage("SGF imported on this device; account sync will retry later."));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import SGF."); }
  }
  function exportFile(record: SavedGoGame) {
    const blob = new Blob([exportGoSgf(record.game, record.players, record.savedAt)], { type: "application/x-go-sgf;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `go-${record.savedAt.slice(0, 10)}-${record.game.boardSize}x${record.game.boardSize}.sgf`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="go-page">
    <header className="go-page-header"><Link to="/games/go"><ArrowLeft size={16} /> Go</Link><h1>Go Analysis</h1><span>Review, learn, improve</span></header>
    {game ? <GoGameReview key={selected?.id ?? "latest"} game={game} /> : <section className="go-empty-review"><h2>Ready to review</h2><p>Play and save a Go game, then return here to step through its moves.</p><Link className="go-action" to="/games/go">Start a game</Link></section>}
    <section className="go-library" aria-label="Saved Go games">
      <div className="go-library-heading"><div><h2>Saved games</h2><p className="go-muted">{selected ? `${selected.players.black} vs ${selected.players.white} · ${selected.game.moveHistory.length} moves` : "Choose a game to replay and analyze."}</p></div><div className="go-library-tools"><label className="go-action"><Upload size={15} /> Import SGF<input type="file" accept=".sgf,application/x-go-sgf,text/plain" onChange={event => void importFile(event)} hidden /></label><button className="go-action" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}>{libraryOpen ? "Hide library" : "Browse library"}</button></div></div>
      {message && <p role="status" className="go-muted">{message}</p>}
      {user && visibleSaved.some(record => !record.ownerId) && <button className="go-action" onClick={() => void claimLocalGoGames(user.id).then(setSaved).then(() => setMessage("Local games synced to your account.")).catch(error => setMessage(error instanceof Error ? error.message : "Could not sync local games."))}>Sync local games to my account</button>}
      {libraryOpen && (visibleSaved.length ? <div className="go-library-list">{visibleSaved.map(record => <div className="go-library-item" key={record.id}>
        <Link to={`/games/go/analysis?game=${encodeURIComponent(record.id)}`} onClick={showReview} aria-current={selected?.id === record.id ? "page" : undefined}><strong>{record.players.black} vs {record.players.white}</strong><span>{record.game.boardSize} × {record.game.boardSize} · {record.game.moveHistory.length} moves · {record.game.result ?? "Unfinished"}</span><small>{new Date(record.savedAt).toLocaleString()}</small></Link>
        <div><Link className="go-action" to={`/games/go/analysis?game=${encodeURIComponent(record.id)}`} onClick={showReview}>Replay / Analyze</Link>{record.game.status === "playing" && (record.mode === "ai" || record.mode === "hotseat") && <Link className="go-action" to={`/games/go/${record.mode}?resume=${encodeURIComponent(record.id)}`}>Continue</Link>}<button className="go-delete" aria-label={`Export ${record.players.black} vs ${record.players.white} as SGF`} onClick={() => exportFile(record)}><Download size={16} /></button><button className="go-delete" aria-label={`Delete ${record.players.black} vs ${record.players.white}`} onClick={() => void remove(record)}><Trash2 size={16} /></button></div>
      </div>)}</div> : <p className="go-muted">No saved games yet. You can save any ongoing or finished local game.</p>)}
    </section>
  </main>;
}
