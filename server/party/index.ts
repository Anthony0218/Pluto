import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { PartyRooms } from "./rooms.ts";
import type { Session } from "./rooms.ts";
import { clientError, isExpectedError } from "./errors.ts";
import { log } from "./log.ts";
import { NETWORK_CONFIG } from "../../src/games/party/config.ts";
import { parseMessage } from "../../src/games/party/network/protocol.ts";
import type { ServerMessage } from "../../src/games/party/types.ts";
// Configuration (all optional; see .env.example):
//   PARTY_PORT, PARTY_HOST          listen address (default 127.0.0.1:8787)
//   PORT                            fallback for PARTY_PORT (set by Render, Railway, Fly, …)
//   PARTY_ORIGINS                   comma-separated browser origins allowed to open the socket
//   PARTY_TRUST_PROXY=1             use X-Forwarded-For for rate limiting behind a reverse proxy
//   PARTY_LOG_LEVEL                 debug | info | warn | error | silent
function allowedOrigins(): string[] | null {
  const list = process.env.PARTY_ORIGINS?.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return list?.length ? list : null;
}
function clientAddress(request: IncomingMessage): string {
  if (process.env.PARTY_TRUST_PROXY === "1") {
    const forwarded = request.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.socket.remoteAddress ?? "unknown";
}
export function startPartyServer(
  port = Number(process.env.PARTY_PORT ?? process.env.PORT ?? 8787),
  host = process.env.PARTY_HOST ?? "127.0.0.1",
) {
  const rooms = new PartyRooms();
  const startedAt = Date.now();
  let closing = false;
  // Minimal health check for load balancers: no internal details.
  const http = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (req.method === "GET" && (path === "/health" || path === "/")) {
      res.writeHead(closing ? 503 : 200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          service: "pluto-party",
          status: closing ? "shutting-down" : "ok",
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        }),
      );
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  const sockets = new WebSocketServer({
    server: http,
    path: "/party-socket",
    maxPayload: NETWORK_CONFIG.maxPayloadBytes,
  });
  const origins = allowedOrigins();
  if (!origins && process.env.NODE_ENV === "production")
    log.warn("config.origins_unrestricted", {
      hint: "set PARTY_ORIGINS to the client origin(s) in production",
    });
  const alive = new WeakMap<WebSocket, boolean>();
  sockets.on("connection", (socket, request) => {
    if (closing) {
      socket.close(1012, "Server restarting");
      return;
    }
    if (origins && !origins.includes(request.headers.origin ?? "")) {
      log.warn("socket.origin_rejected", { origin: request.headers.origin ?? "none" });
      socket.close(1008, "Origin not allowed");
      return;
    }
    const address = clientAddress(request);
    alive.set(socket, true);
    socket.on("pong", () => alive.set(socket, true));
    let session: Session | undefined,
      count = 0,
      windowStart = Date.now();
    const send = (message: ServerMessage) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(message));
    };
    const handshake = setTimeout(() => {
      if (!session) socket.close(1008, "Handshake required");
    }, NETWORK_CONFIG.handshakeTimeoutMs);
    socket.on("message", (raw) => {
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        count = 0;
      }
      if (++count > NETWORK_CONFIG.maxMessagesPerSecond) {
        log.warn("socket.flood", { player: session?.id, address });
        socket.close(1008, "Too many messages");
        return;
      }
      try {
        const msg = parseMessage(JSON.parse(raw.toString()) as unknown);
        if (msg.type === "HELLO") {
          if (session) throw new Error("Session already established.");
          session = rooms.connect(msg.token, send, {
            address,
            close: (code, reason) => socket.close(code, reason),
          });
          clearTimeout(handshake);
        } else if (msg.type === "PING") {
          send({ type: "PONG" });
        } else {
          if (!session || session.send !== send)
            throw new Error("Reconnect to establish your session.");
          rooms.handle(session, msg);
        }
      } catch (error) {
        if (!isExpectedError(error) && !(error instanceof SyntaxError))
          log.error("socket.message_failed", {
            player: session?.id,
            room: session?.room,
            error: error instanceof Error ? error.message : String(error),
          });
        send({ type: "ERROR", ...clientError(error) });
      }
    });
    socket.on("error", () => socket.close());
    socket.on("close", () => {
      clearTimeout(handshake);
      if (session?.send === send) rooms.disconnect(session);
    });
  });
  // Dead mobile sockets often never send a close frame: a missed ping marks the socket dead, which starts
  // the normal reconnect grace period for its player.
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      if (!alive.get(socket)) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, NETWORK_CONFIG.heartbeatMs);
  const timer = setInterval(() => rooms.tick(), 700);
  const minigameTimer = setInterval(() => rooms.fastTick(), 100);
  const stopTimers = () => {
    clearInterval(timer);
    clearInterval(minigameTimer);
    clearInterval(heartbeat);
  };
  sockets.on("error", (error) => {
    log.error("socket.server_error", { error: error.message });
  });
  http.once("error", (error) => {
    log.error("server.listen_failed", { error: error.message });
    stopTimers();
    sockets.close();
  });
  http.listen(port, host, () =>
    log.info("server.start", {
      host,
      port: (http.address() as { port: number }).port,
      origins: origins?.join(",") ?? "any",
    }),
  );
  // Graceful stop: refuse new work, tell connected players, close sockets and the HTTP server. Live
  // matches are in memory and do not survive a process restart.
  const shutdown = (reason = "shutdown") =>
    new Promise<void>((resolve) => {
      if (closing) return resolve();
      closing = true;
      log.info("server.stop", { reason, rooms: rooms.rooms.size });
      stopTimers();
      for (const session of rooms.sessions.values())
        session.send?.({
          type: "ERROR",
          code: "SHUTDOWN",
          message: "The party server is restarting. Active matches cannot be restored.",
        });
      for (const socket of sockets.clients) socket.close(1012, "Server restarting");
      sockets.close();
      http.close(() => resolve());
      // Sockets that ignore the close frame are cut after a short grace.
      setTimeout(() => {
        for (const socket of sockets.clients) socket.terminate();
        http.closeAllConnections?.();
      }, 2000).unref();
    });
  return {
    http,
    rooms,
    sockets,
    shutdown,
    close: () => {
      closing = true;
      stopTimers();
      sockets.clients.forEach((s) => s.terminate());
      sockets.close();
      http.close();
    },
  };
}
if (import.meta.main) {
  const server = startPartyServer();
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      const force = setTimeout(() => process.exit(1), 5000);
      force.unref();
      void server.shutdown(signal).then(() => process.exit(0));
    });
  process.on("unhandledRejection", (reason) => {
    log.error("server.unhandled_rejection", {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });
}
