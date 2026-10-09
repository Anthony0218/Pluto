import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Globe2,
  LockKeyhole,
  Radio,
  Users,
} from "lucide-react";
import type { PartyConnection } from "../../../games/party/network/usePartyConnection.ts";
import PartyBoard from "./PartyBoard.tsx";
import { mapRegistry, tropical } from "../../../games/party/content/maps.ts";
import { NAME_LIMITS } from "../../../games/party/config.ts";
import MinigameCatalog from "./MinigameCatalog.tsx";
export default function PartyHome({
  connection,
}: {
  connection: PartyConnection;
}) {
  const { status, lobbies, lobbiesLoaded, pending, send } = connection;
  const [tab, setTab] = useState<"create" | "find" | "join">("create");
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("pluto-party-name") || "Explorer";
    } catch {
      return "Explorer";
    }
  });
  const [lobbyName, setLobbyName] = useState("A little island chaos");
  const [isPublic, setIsPublic] = useState(true),
    [query, setQuery] = useState(""),
    [code, setCode] = useState("");
  const online = status === "online";
  const busy = pending === "create" || pending === "join";
  const saveName = () => {
    try {
      localStorage.setItem("pluto-party-name", name.trim());
    } catch {
      // Remembering the name is a convenience only.
    }
  };
  useEffect(() => {
    if (status === "online" && tab === "find") {
      send({ type: "LIST", query });
      const timer = setInterval(() => send({ type: "LIST", query }), 5000);
      return () => clearInterval(timer);
    }
  }, [status, tab, query, send]);
  return (
    <>
      <section className="pp-home">
        <div className="pp-hero">
          <span className="pp-eyebrow">
            <span /> A LITTLE FRIENDLY CHAOS
          </span>
          <h1>
            Good friends.
            <br />
            Questionable
            <br />
            <em>decisions.</em>
          </h1>
          <p>
            Four explorers. Six sun-soaked islands.
            <br />
            Take a chance, choose your path, and make
            <br className="pp-desktop" /> a little trouble along the way.
          </p>
          <div className="pp-tags">
            <span>
              <Users size={16} /> 4 players
            </span>
            <span>Friends + bots</span>
            <span>Touch friendly</span>
          </div>
          <div className="pp-home-art">
            <PartyBoard map={tropical} match={null} onSelect={() => {}} preview />
            <div className="pp-postcard">
              Greetings from
              <br />
              <strong>Sunspill Islands</strong>
              <span>YOUR NEXT BAD IDEA STARTS HERE ↗</span>
            </div>
          </div>
        </div>
        <section className="pp-card pp-launch">
          <div className="pp-card-top">
            <span className="pp-eyebrow">MAKE SOME MEMORIES</span>
            <span className="pp-sticker">✦</span>
          </div>
          <h2>Get the party started.</h2>
          <p>Play the board or jump straight into a Minigame Festival. Choose in your lobby.</p>
          <div className="pp-tabs" role="tablist" aria-label="Lobby options">
            {(["create", "find", "join"] as const).map((t) => (
              <button
                role="tab"
                aria-selected={tab === t}
                key={t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t === "create"
                  ? "Create game"
                  : t === "find"
                    ? "Find game"
                    : "Join with code"}
              </button>
            ))}
          </div>
          <label>
            Your explorer name
            <input
              maxLength={NAME_LIMITS.player}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
            />
          </label>
          {tab === "create" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
                send({
                  type: "CREATE",
                  name: lobbyName,
                  playerName: name,
                  public: isPublic,
                });
              }}
            >
              <label>
                Lobby name
                <input
                  required
                  maxLength={NAME_LIMITS.lobby}
                  value={lobbyName}
                  onChange={(e) => setLobbyName(e.target.value)}
                />
              </label>
              <div className="pp-visibility">
                <button
                  type="button"
                  className={isPublic ? "selected" : ""}
                  onClick={() => setIsPublic(true)}
                >
                  <Globe2 size={18} />
                  <span>
                    Public<small>Everyone’s invited</small>
                  </span>
                  {isPublic && <Check size={16} />}
                </button>
                <button
                  type="button"
                  className={!isPublic ? "selected" : ""}
                  onClick={() => setIsPublic(false)}
                >
                  <LockKeyhole size={18} />
                  <span>
                    Private<small>Just your crew</small>
                  </span>
                  {!isPublic && <Check size={16} />}
                </button>
              </div>
              <button
                className="pp-primary"
                disabled={!online || busy || !name.trim() || !lobbyName.trim()}
                aria-busy={pending === "create"}
              >
                {pending === "create" ? (
                  <>
                    <span className="pp-spinner small" aria-hidden="true" /> Creating lobby…
                  </>
                ) : (
                  <>
                    Create lobby <ArrowRight size={19} />
                  </>
                )}
              </button>
            </form>
          )}
          {tab === "join" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
                send({ type: "JOIN", code, playerName: name });
              }}
            >
              <label>
                Lobby code
                <input
                  required
                  placeholder="PLUTO-123456"
                  maxLength={20}
                  value={code}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  aria-describedby="pp-code-help"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <small id="pp-code-help">The six digits alone work too.</small>
              </label>
              <button
                className="pp-primary"
                disabled={!online || busy || !name.trim() || !code.trim()}
                aria-busy={pending === "join"}
              >
                {pending === "join" ? (
                  <>
                    <span className="pp-spinner small" aria-hidden="true" /> Joining…
                  </>
                ) : (
                  <>
                    Join the crew <ArrowRight size={19} />
                  </>
                )}
              </button>
            </form>
          )}
          {tab === "find" && (
            <div>
              <label>
                Search lobbies
                <input
                  placeholder="Lobby name or exact private code"
                  value={query}
                  maxLength={60}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="pp-lobby-list" aria-busy={!lobbiesLoaded}>
                {!lobbiesLoaded ? (
                  <p>
                    <span className="pp-spinner small" aria-hidden="true" />{" "}
                    {online ? "Looking for lobbies…" : "Waiting for the server…"}
                  </p>
                ) : lobbies.length === 0 ? (
                  <p>No open lobbies yet. Start one and invite your crew.</p>
                ) : (
                  lobbies.map((room) => (
                    <article key={room.code}>
                      <div>
                        <strong>{room.name}</strong>
                        <small>
                          {room.count}/4 ·{" "}
                          {room.mode === "festival" ? "Minigames only" : mapRegistry.all().find((m) => m.id === room.mapId)?.name ?? "Unknown map"} ·{" "}
                          {room.public ? "Public" : "Private"}
                        </small>
                      </div>
                      <button
                        disabled={!online || busy || !name.trim()}
                        aria-label={`Join ${room.name}`}
                        onClick={() => {
                          saveName();
                          send({
                            type: "JOIN",
                            code: room.code,
                            playerName: name,
                          });
                        }}
                      >
                        Join <ArrowRight size={15} />
                      </button>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="pp-footnote">
            <Radio size={15} /> Live multiplayer · no account needed
          </div>
        </section>
      </section>
      <MinigameCatalog />
      <footer className="pp-home-footer">
        <span>01 / THE ISLAND CHAPTER</span>
        <span>
          THE GOLDEN PLUTO HUNT <i>•</i> EARLY PLAYABLE BUILD
        </span>
      </footer>
    </>
  );
}
