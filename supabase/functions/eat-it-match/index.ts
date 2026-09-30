import { createClient } from 'jsr:@supabase/supabase-js@2';
import { applyRoomAction, parseSettings } from '../../../src/games/eat-it/authority.ts';
import { EAT } from '../../../src/games/eat-it/config.ts';
import type { Room } from '../../../src/games/eat-it/types.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return respond({ error: 'POST required' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Sign in to play multiplayer' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return respond({ error: 'Session expired. Please sign in again.' }, 401);
    const raw = await request.text(); if (raw.length > 2048) return respond({ error: 'Request too large' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || Array.isArray(body) || typeof body !== 'object') return respond({ error: 'Invalid request' }, 400);
    // A profile lookup is needed only when allocating a seat, not every input packet.
    let name = 'Player';
    if (body.op === 'join' || body.op === 'create') {
      const { data: profile } = await db.from('profiles').select('display_name,username').eq('id', user.id).maybeSingle();
      name = String(profile?.display_name || profile?.username || 'Player').slice(0, 28);
    }
    if (body.op === 'create') {
      const settings = parseSettings(body);
      const { count } = await db.from('eat_it_matches').select('id', { head: true, count: 'exact' }).eq('host_id', user.id).gte('created_at', new Date(Date.now() - 3600000).toISOString());
      if ((count ?? 0) >= 20) return respond({ error: 'Too many rooms. Reuse an existing room.' }, 429);
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < EAT.network.maxRetries; attempt++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => alphabet[b % alphabet.length]).join('');
        const { data, error } = await db.from('eat_it_matches').insert({ room_code: code, host_id: user.id, settings,
          players: [{ id: user.id, name, ready: false, lastSeen: Date.now() }], last_tick: Date.now() }).select().single();
        if (!error) return respond(data);
        if (error.code !== '23505') throw new Error('Could not create room. Check the Eat It backend deployment.');
      }
      throw new Error('Could not allocate a room code');
    }
    const code = String(body.code ?? '').toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('Invalid room code');
    for (let attempt = 0; attempt < Math.max(EAT.network.maxRetries, EAT.match.maxPlayers); attempt++) {
      const { data, error } = await db.from('eat_it_matches').select().eq('room_code', code).maybeSingle();
      if (error) throw new Error('Could not load room. Check the Eat It backend deployment.');
      if (!data) return respond({ error: 'Room not found' }, 404);
      const room = data as Room, version = room.version;
      if (body.op !== 'join' && !room.players.some(p => p.id === user.id)) return respond({ error: 'Join this room first' }, 403);
      const changed = applyRoomAction(room, user.id, name, body, Date.now(), crypto.getRandomValues(new Uint32Array(1))[0], crypto.randomUUID());
      if (!changed) return respond(room);
      const { data: updated, error: saveError } = await db.from('eat_it_matches').update({
        players: room.players, host_id: room.host_id, status: room.status, game_state: room.game_state,
        last_tick: room.last_tick, version: version + 1, updated_at: new Date().toISOString(),
      }).eq('id', room.id).eq('version', version).select().maybeSingle();
      if (saveError) throw new Error('Could not save match');
      if (updated) return respond(updated);
      // Another request won the race. Recompute from its state; never overwrite it.
    }
    return respond({ error: 'Room is busy. Retrying…' }, 409);
  } catch (cause) { return respond({ error: cause instanceof Error ? cause.message : 'Request failed' }, 400); }
});
