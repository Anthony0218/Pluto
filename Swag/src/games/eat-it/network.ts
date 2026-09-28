import { supabase } from '../../lib/supabase';
import { EAT } from './config';
import { SnapshotBuffer } from './presentation';
import type { GameState, Input, Room } from './types';

export async function roomAction(body: Record<string, unknown>, signal?: AbortSignal): Promise<Room> {
  const { data, error } = await supabase.functions.invoke('eat-it-match', { body, signal, timeout: EAT.network.requestTimeoutMs });
  if (error) {
    const context = (error as { context?: Response }).context;
    let message: string | undefined;
    try { message = (await context?.json())?.error; } catch { /* Keep the transport error. */ }
    throw new Error(message || error.message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as Room;
}
/** All messages carry intent only. Database snapshots are the authoritative source. */
export class EatConnection {
  source: { current: GameState };
  input: Input = { x: 0, y: 0 };
  receivedAt = performance.now();
  private version: number;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private channel: ReturnType<typeof supabase.channel>;
  private abort = new AbortController();
  private snapshots = new SnapshotBuffer();
  private onRoom: (room: Room) => void;
  private onError: (error: string) => void;
  constructor(room: Room, onRoom: (room: Room) => void, onError: (error: string) => void) {
    this.onRoom = onRoom; this.onError = onError;
    this.source = { current: room.game_state! }; this.version = room.version;
    this.snapshots.push(this.source.current, this.receivedAt);
    this.channel = supabase.channel(`eat-it-play-${room.room_code}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eat_it_matches', filter: `room_code=eq.${room.room_code}` }, payload => this.accept(payload.new as Room))
      .subscribe();
    const poll = async () => {
      if (this.stopped) return;
      const started = performance.now();
      try {
        const next = await roomAction({ op: 'input', code: room.room_code, input: this.input }, this.abort.signal);
        if (!this.stopped) { this.accept(next); this.onError(''); }
      } catch (cause) { if (!this.stopped) this.onError(cause instanceof Error ? cause.message : 'Connection interrupted'); }
      if (!this.stopped) this.timer = setTimeout(poll, Math.max(20, EAT.network.inputIntervalMs - (performance.now() - started)));
    };
    void poll();
  }
  private accept(room: Room) {
    if (this.stopped || room.version <= this.version) return;
    this.version = room.version;
    if (room.game_state) {
      this.source.current = room.game_state; this.receivedAt = performance.now();
      this.snapshots.push(room.game_state, this.receivedAt);
    }
    if (room.status !== 'playing') this.onRoom(room);
  }
  presentation(now: number, localId: string) { return this.snapshots.sample(now, localId, this.input); }
  close() { this.stopped = true; this.abort.abort(); clearTimeout(this.timer); void supabase.removeChannel(this.channel); }
}
