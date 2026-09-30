import { useCallback, useEffect, useRef, useState } from "react";
import { NETWORK_CONFIG } from "../config.ts";
import type {
  ClientMessage,
  ErrorCode,
  Lobby,
  LobbySummary,
  ServerMessage,
} from "../types.ts";
// connecting: first attempt · online: session established and state received · reconnecting: lost the
// socket, retrying with backoff · offline: several attempts failed (server unreachable) · replaced: this
// session was opened in another tab, so this one stops reconnecting until the player asks.
export type ConnectionStatus = "connecting" | "online" | "reconnecting" | "offline" | "replaced";
// Requests that change screens; the UI shows a loading state until the server answers.
export type PendingRequest = "create" | "join" | "start" | "return" | "leave";
const TOKEN_KEY = "pluto-party-session";
const PENDING: Partial<Record<ClientMessage["type"], PendingRequest>> = {
  CREATE: "create",
  JOIN: "join",
  START: "start",
  RETURN_TO_LOBBY: "return",
  LEAVE: "leave",
};
// sessionStorage keeps the (non-secret-to-the-player, per-tab) reconnect token across a refresh but not
// across tabs, so a second tab is a second explorer. Storage can be unavailable (private mode).
function readToken(): string | undefined {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Without storage a refresh starts a new session; the live socket still works.
  }
}
const backoff = (attempt: number) =>
  Math.min(10_000, 1000 * 2 ** Math.min(attempt, 4)) * (0.75 + Math.random() * 0.5);
export function usePartyConnection() {
  const socket = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [playerId, setPlayerId] = useState("");
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [lobbiesLoaded, setLobbiesLoaded] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  // Increments on every (re)established session: client-only interactions from an older connection
  // (an unconfirmed targeting choice, for example) are dropped rather than resumed.
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [reconnectGraceMs, setReconnectGraceMs] = useState<number>(NETWORK_CONFIG.reconnectGraceMs);
  // Largest observed (server − local) clock offset: network delay only makes snapshots look older.
  const serverOffset = useRef<number | null>(null);
  const hadLobby = useRef(false);
  const reconnectNow = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false,
      replaced = false,
      attempts = 0,
      retryTimer: ReturnType<typeof setTimeout> | undefined,
      pongTimer: ReturnType<typeof setTimeout> | undefined,
      keepAlive: ReturnType<typeof setInterval> | undefined;
    const clearTimers = () => {
      clearTimeout(retryTimer);
      clearTimeout(pongTimer);
      clearInterval(keepAlive);
    };
    // Liveness probe: a socket that cannot answer a PING within 5 s is dead (common after a phone
    // sleeps), so drop it and reconnect instead of waiting for the browser to notice.
    const probe = () => {
      const ws = socket.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      clearTimeout(pongTimer);
      ws.send(JSON.stringify({ type: "PING" }));
      pongTimer = setTimeout(() => ws.close(), 5000);
    };
    const connect = () => {
      if (disposed || replaced) return;
      clearTimers();
      const url =
        import.meta.env.VITE_PARTY_SERVER_URL ||
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/party-socket`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        setStatus("offline");
        return;
      }
      socket.current = ws;
      ws.onopen = () => {
        if (disposed || socket.current !== ws) return;
        ws.send(JSON.stringify({ type: "HELLO", token: readToken() }));
      };
      ws.onmessage = (e) => {
        if (disposed || socket.current !== ws) return;
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(e.data)) as ServerMessage;
        } catch {
          return;
        }
        clearTimeout(pongTimer);
        switch (msg.type) {
          case "SESSION":
            writeToken(msg.token);
            setPlayerId(msg.playerId);
            setReconnectGraceMs(msg.reconnectGraceMs);
            setSessionEpoch((n) => n + 1);
            attempts = 0;
            if (!msg.resumed && hadLobby.current) {
              setError(
                "Reconnect failed: your previous game is no longer available (the server may have restarted).",
              );
              setErrorCode("SERVER_ERROR");
            }
            clearInterval(keepAlive);
            keepAlive = setInterval(() => {
              if (document.visibilityState === "visible") probe();
            }, 25_000);
            break;
          case "STATE":
            if (msg.serverNow !== undefined) {
              const observed = msg.serverNow - Date.now();
              if (serverOffset.current === null || observed > serverOffset.current)
                serverOffset.current = observed;
            }
            hadLobby.current = msg.lobby !== null;
            setLobby(msg.lobby);
            setPending(null);
            setStatus("online");
            break;
          case "LOBBIES":
            setLobbies(msg.lobbies);
            setLobbiesLoaded(true);
            break;
          case "ERROR":
            setError(msg.message);
            setErrorCode(msg.code ?? null);
            setPending(null);
            if (msg.code === "SESSION_REPLACED") {
              replaced = true;
              setStatus("replaced");
            }
            break;
          case "PONG":
            break;
        }
      };
      ws.onclose = () => {
        if (disposed || socket.current !== ws) return;
        clearTimers();
        setPending(null);
        if (replaced) return;
        attempts++;
        setStatus(attempts >= 4 ? "offline" : "reconnecting");
        retryTimer = setTimeout(connect, backoff(attempts));
      };
      ws.onerror = () => ws.close();
    };
    // Coming back to the foreground or regaining network: check the socket at once instead of waiting
    // for the next backoff step. No polling while hidden.
    const wake = () => {
      if (disposed || replaced || document.visibilityState !== "visible") return;
      const ws = socket.current;
      if (ws?.readyState === WebSocket.OPEN) probe();
      else if (!ws || ws.readyState === WebSocket.CLOSED) connect();
    };
    reconnectNow.current = () => {
      replaced = false;
      attempts = 0;
      setStatus("reconnecting");
      socket.current?.close();
      connect();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    connect();
    return () => {
      disposed = true;
      clearTimers();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      socket.current?.close();
    };
  }, []);
  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState !== WebSocket.OPEN) {
      setError("Reconnecting to the game server. Please wait a moment.");
      setErrorCode(null);
      return;
    }
    setError("");
    setErrorCode(null);
    const request = PENDING[message.type];
    if (request) setPending(request);
    socket.current.send(JSON.stringify(message));
  }, []);
  const retry = useCallback(() => reconnectNow.current(), []);
  const clearError = useCallback(() => {
    setError("");
    setErrorCode(null);
  }, []);
  return {
    status,
    playerId,
    lobby,
    lobbies,
    lobbiesLoaded,
    error,
    errorCode,
    pending,
    sessionEpoch,
    reconnectGraceMs,
    serverOffset,
    send,
    retry,
    clearError,
  };
}
export type PartyConnection = ReturnType<typeof usePartyConnection>;
