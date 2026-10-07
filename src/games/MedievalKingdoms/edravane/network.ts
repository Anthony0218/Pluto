import { supabase } from "../../../lib/supabase.ts";
import type { CouncilReply, CouncilRequest } from "./multiplayer.ts";
const RECONNECT_KEY = "edravane-supabase-council";
export function savedCouncil(): string | null {
  try {
    return sessionStorage.getItem(RECONNECT_KEY);
  } catch {
    return null;
  }
}
export async function councilAction(
  body: CouncilRequest,
): Promise<CouncilReply> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw Error("Log in to host or join multiplayer.");
  const { data, error } = await supabase.functions.invoke("edravane-match", {
    body,
    timeout: 20000,
  });
  if (error) {
    let message: string | undefined;
    try {
      message = (await (error as { context?: Response }).context?.json())
        ?.error;
    } catch {
      /* Use the transport message. */
    }
    throw Error(
      message ||
        "Could not reach the Supabase council. Check the connection and backend deployment.",
    );
  }
  if (data?.error) throw Error(String(data.error));
  if (!data?.room || typeof data.room.version !== "number")
    throw Error("Invalid council response");
  return data as CouncilReply;
}
/** Clients send intentions. Only authenticated Edge Function snapshots become game state. */
export class CouncilConnection {
  private channel: ReturnType<typeof supabase.channel>;
  private timer: ReturnType<typeof setInterval>;
  private closed = false;
  private version = -1;
  private code: string;
  private seq: number;
  private queue: Promise<void> = Promise.resolve();
  private refreshing = false;
  private refreshAgain = false;
  private onSnapshot: (reply: CouncilReply) => void;
  private onStatus: (status: string) => void;
  private onError: (message: string) => void;
  constructor(
    initial: CouncilReply,
    onSnapshot: (reply: CouncilReply) => void,
    onStatus: (status: string) => void,
    onError: (message: string) => void,
  ) {
    this.onSnapshot = onSnapshot;
    this.onStatus = onStatus;
    this.onError = onError;
    this.code = initial.room.code;
    this.seq = initial.seq;
    sessionStorage.setItem(RECONNECT_KEY, this.code);
    this.accept(initial);
    this.channel = supabase
      .channel(`edravane-${this.code}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "edravane_room_events",
          filter: `code=eq.${this.code}`,
        },
        (payload) => {
          if (Number(payload.new.version) > this.version) void this.refresh();
        },
      )
      .subscribe((status) => {
        if (this.closed) return;
        if (status === "SUBSCRIBED") void this.refresh();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          this.onStatus("Live updates interrupted · checking saved turns");
      });
    this.timer = setInterval(() => {
      void this.heartbeat();
    }, 30000);
    document.addEventListener("visibilitychange", this.visibility);
    window.addEventListener("online", this.visibility);
  }
  private accept(reply: CouncilReply) {
    if (this.closed || reply.room.version < this.version) return;
    this.version = reply.room.version;
    this.seq = Math.max(this.seq, reply.seq);
    this.onSnapshot(reply);
    this.onStatus(
      reply.room.slots.some((s) => s.player === reply.player && s.connected)
        ? "Connected"
        : "Disconnected · bot takeover active · reconnect to resume",
    );
  }
  private visibility = () => {
    if (document.visibilityState === "visible") void this.heartbeat();
  };
  private async heartbeat() {
    if (this.closed) return;
    const { data, error } = await supabase.rpc("edravane_heartbeat", {
      p_code: this.code,
    });
    if (this.closed) return;
    if (error) {
      this.onStatus("Disconnected · reconnect to resume");
      return;
    }
    if (data?.needs_sync || Number(data?.version) > this.version)
      await this.refresh();
    else this.onStatus("Connected");
  }
  async refresh() {
    if (this.closed) return;
    if (this.refreshing) {
      this.refreshAgain = true;
      return;
    }
    this.refreshing = true;
    try {
      this.accept(await councilAction({ type: "snapshot", code: this.code }));
    } catch (cause) {
      if (!this.closed)
        this.onStatus(
          cause instanceof Error ? cause.message : "Connection interrupted",
        );
    } finally {
      this.refreshing = false;
      if (this.refreshAgain) {
        this.refreshAgain = false;
        void this.refresh();
      }
    }
  }
  send(request: CouncilRequest) {
    this.queue = this.queue.then(async () => {
      if (this.closed) return;
      try {
        const body = { ...request, code: this.code };
        if (body.type === "command") body.seq = ++this.seq;
        this.accept(await councilAction(body));
      } catch (cause) {
        if (!this.closed) {
          this.onError(
            cause instanceof Error ? cause.message : "Council request failed",
          );
          await this.refresh();
        }
      }
    });
  }
  close(leave = true) {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("online", this.visibility);
    void supabase.removeChannel(this.channel);
    if (leave)
      void councilAction({ type: "leave", code: this.code }).catch(() => {});
  }
}
