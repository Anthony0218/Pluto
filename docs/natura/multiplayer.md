# Natura multiplayer with Supabase

The dedicated Node authority was replaced at the user's request on 4 October 2026. **Natura needs no separate game server.** It uses the existing Supabase project for Realtime Broadcast, while the room creator's browser runs the match. Solo, simultaneous local play and alternating hotseat remain independent of Supabase.

## Running and publishing

```sh
npm run dev
```

Keep the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. No Natura environment variables, new Edge Function, SQL migration, service-role key, TURN service or extra server deployment is needed. Realtime public Broadcast must be enabled on the project. The local preview was verified against the configured Supabase project with the former Natura server stopped.

Build/publish the frontend through the existing site workflow. The frontend change has not been published to the public site in this task. `npm run dev:all` still runs Pluto Party's server alongside Vite; Natura no longer participates in that command. The old `natura:server`, `/natura-socket` proxy and authority environment variables have been removed.

## Online contract

Two players create/join a six-character invite room. The host selects habitat, course and whale variant; both players ready up for a synchronized start. Every device uses WASD/Space or its own touch controls. `rooms.ts` owns simulation, collisions, scoring, countdowns, pause and guest reconnect inside the host's browser. The guest sends validated intent, never authoritative positions or scores. Both views use the existing world adapter and renderer.

Simulation runs around 60 Hz with bounded substeps. Guest intent is relayed at most every 100 ms; short taps are latched until transmission. Inputs expire after 250 ms. Projected guest snapshots run at most 10 Hz, with body interpolation on receipt. Lobby/paused snapshots run at 1 Hz. Message queues, packet sizes, sessions and pending peers are bounded. No movement is written into Postgres or sent through repeated Edge Function requests.

Keep the host's tab **open and active**. Hiding it pauses the match; a long simulation stall also pauses instead of silently slowing the game. Both players must be ready to resume. Guest connection loss clears input and pauses the room; after detection the seat is held for 20 seconds, then the connected host wins by forfeit. Guest refresh uses a per-tab, per-room reconnect token and automatically rejoins the same seat. Explicitly leaving a live round is a forfeit.

Host closure, reload or sustained loss of contact ends the room. The guest returns to setup with an explanation and can create or join another room. There is no live host migration, persistent match save or independent competitive referee. Browser suspension can interrupt play. Unknown/expired codes fail without trapping the player in a disconnected room.

## Views and trust

`privateView.ts` filters the world before serialization: concealed vole positions, distant/ink-obscured pursuit opponents, opponent sensing memory and distant whale prey are not included in the guest's projected snapshot. The host's normal rendered view also uses the projection.

The shared Broadcast topic carries only ephemeral public-key handshakes and encrypted envelopes. P-256 ECDH derives a pair key; AES-GCM protects inputs, reconnect tokens and projected snapshots. Room, peers, connection nonce and sequence number are bound to each encrypted message; replayed and invalid ciphertext have no effect. A passive listener to the room topic cannot read another seat's snapshots merely by ignoring the frontend's recipient filter.

**The browser host holds the full world.** They can inspect it or change their own code. Invitations/public-key discovery are not authenticated competitive matchmaking and do not defend against an active room impostor. This is friendly invite play, not independent anti-cheat. Public channels are not being presented as Supabase RLS-protected private channels. HTTPS (or localhost) is required for Web Crypto. No account sign-in or unrelated Supabase security settings are changed.

Supabase still supplies the relay infrastructure. This removes a separately hosted, sleeping Natura process; it does not make Supabase free or unlimited, nor guarantee availability of a paused Supabase project. Broadcast traffic consumes the project's shared Realtime/egress quotas. Revisit rates/transport or hosting when measured usage warrants it. See [Broadcast](https://supabase.com/docs/guides/realtime/broadcast) and [Realtime limits](https://supabase.com/docs/guides/realtime/limits).

## Other play formats and expansions

Alternating hotseat pairs equal seeds, courses, difficulty and animal roles. Meadow and whale-versus-squid use four alternating turns; other studies use two. The handover screen unmounts the previous world. Completion, progress, health/falls and time are compared within each role, with time rounded to tenths of a second. Role wins decide the match's existing three-point award. Simultaneous local play retains its original two-controller shared-screen format.

The optional whale-versus-squid challenge retains the original whale hunt/race: whale breath, coarse echoes and three bites versus squid survival, burst and ink. Both solo roles, online and hotseat work through the same world simulation. Combat/cooldowns remain labeled game fiction.

Snap Launch has sixteen courses, including six new moving-shelf, wind, gate, crumble and combined mastery studies. Silk & Summit has eight 24-platform courses, including five new cavern, waterfall, ridge, night and storm studies. Movement, gates and surface hazards use the same functions in rendering, human physics and bot reachability checks.

## Verification

```sh
npm run check:natura
node --test tests/natura-3d.test.mjs tests/natura-field-station.test.mjs tests/natura-expansion.test.mjs tests/natura-online.test.mjs tests/natura-relay.test.mjs tests/wildModes.test.mjs tests/toolAnimals.test.mjs tests/archerfish.test.mjs tests/natura-modes.test.mjs
```

The relay tests exercise two independent clients through the injectable message bus using real Web Crypto, including configuration/readiness, private seat views, short squid taps, shared pause/resume, guest refresh/seat reclamation, old transport cleanup, host closure, forfeit/rematch, invalid commands and tampered/replayed packets. The bus is a test double, not the production transport.

Live browser verification also used the real configured Supabase relay: two clients created/joined a room, played whale-versus-squid, relayed burst/ink, paused together, refreshed/reclaimed the guest seat, resumed by mutual readiness, recorded a guest-leave forfeit and observed host restart ending the room. No dedicated Natura server ran during those checks. Proof: [Supabase match](supabase-online.jpg). WAN latency/load testing, physical-phone profiling and a representative human difficulty study remain outside this work.

See [the site's multiplayer architecture review](../multiplayer-architecture.md) for future server priorities and the Pluto Party assessment.
