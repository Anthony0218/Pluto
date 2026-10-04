# Multiplayer hosting review

Reviewed the current repository on 4 October 2026. This is a code/architecture assessment, not a production load benchmark. No other game's transport or deployment was changed.

## What “server” means here

Supabase already runs server infrastructure. The useful distinction is an existing managed database/Realtime/Edge Function backend versus an additional continuously running game process. Move validation, clocks, card secrecy or ratings can remain authoritative on Supabase without a separately hosted Node service. Revenue alone is not a reason to migrate: measurable latency, concurrent traffic, operating cost and competitive requirements are better triggers.

## Priorities

| Game | Current multiplayer approach | Recommendation |
| --- | --- | --- |
| Eat It | `network.ts` sends input through `eat-it-match` about every 125 ms. The Edge handler reads state, advances simulation and updates Postgres with version-conflict retries; Realtime carries database changes. | **Highest future migration priority.** A continuous authority with WebSocket snapshots can separate frame simulation from database writes, reduce request/conflict overhead and support smoother larger matches. Migrate when latency, concurrent-player count or invocation/write cost becomes a demonstrated problem. |
| Pluto Party | Dedicated Node/WebSocket authority owns rooms, game state, bots, random outcomes, timers and minigames. | Already has the architecture most appropriate for its existing host-independent behavior. Keep it for now. A Supabase/browser-host conversion is possible for casual play, but is a substantial redesign, not a hosting toggle. |
| Natura | Host-browser simulation with Supabase Broadcast. No dedicated server. | Good for casual invite matches now. Add independent authority later for ranked play, fair hidden information against the host, match continuity through host loss, or demonstrated relay/performance limits. |
| Chess, variants/Fog, Go, Shogi | Supabase RPC/Edge handlers and stored matches; legal-move validation, private Fog views and ranked clocks/results belong to the backend in the applicable modes. | Keep Supabase. Turn-based actions need no permanent simulation loop. Very fast time controls at scale may justify a clock/match service after measurement; preserve backend validation and private views either way. |
| Schafkopf and Card Builder online rooms | Validated Supabase Edge requests and versioned persistent game state. Schafkopf returns per-player views and keeps complete hands on the backend. | Keep Supabase. Turn-based card play benefits from existing private views and persistence, without demanding a dedicated ticking process. Reconsider for substantially larger traffic or expensive custom-game execution. |
| Atlas multiplayer/ranked | `atlas-match` authoritatively generates questions, validates answers, resolves timed rounds and saves versioned scores/results; Realtime updates the lobby. | Keep Supabase for current quiz/strategy modes. Reconsider a continuous room service if high-concurrency timed events or measured request latency require it; ranked authority is already a backend concern. |

Medieval Kingdoms' battle engine is not evidence of an implemented network multiplayer transport; it is not included as an existing online game in this table. A future continuous online battle mode would be another candidate for independent authority.

## Does Pluto Party need its server?

**As implemented, yes. As a game concept, no.**

`src/games/party/network/usePartyConnection.ts` opens `/party-socket`; `server/party/index.ts` is its only current room transport. It runs the board/lifecycle tick every 700 ms and a separate minigame tick every 100 ms. `server/party/rooms.ts` advances match phases, runs bot decisions, manages seat reconnection/host reassignment and replaces abandoned human seats with bots. Minigames such as Paddle Panic run fine-grained physics and publish snapshots at their own cadence. The browser sends commands/inputs and receives views; it does not own that independent match loop.

Deleting the Node process or changing the URL to Supabase would therefore break rooms and gameplay. Copying that indefinitely running process into a Supabase Edge Function is also not a drop-in solution: hosted workers have finite wall-clock and CPU limits ([official limits](https://supabase.com/docs/guides/functions/limits)). Realtime Broadcast relays data; it does not run the Party engine ([official Broadcast documentation](https://supabase.com/docs/guides/realtime/broadcast)).

Two viable alternatives would require engineering work:

- A browser host plus Supabase relay, as in Natura: cheaper operational setup for private matches, but host suspension/loss can interrupt the game, the host sees full state, and existing host reassignment/bot takeover would need a new authority-transfer/checkpoint contract.
- Persistent Supabase state and request-driven authoritative board actions, plus a separate solution for continuous minigames. This preserves backend validation but needs atomic persistence, timer recovery and a redesigned minigame transport/runtime.

The current server is justified by Party's chosen features, not by the fact that it is a board game or that the site might earn money. Cold-start friction is a legitimate downside. Before migrating, compare an always-available hosting option with the cost/complexity of those redesigns; no provider price or startup-time guarantee was assumed in this review.

## Checks supporting the conclusions

- Inspected the active Natura, Party, Eat It, Atlas, chess/strategy and card transports plus corresponding handlers, not only README claims.
- Verified Natura's new relay against real Supabase with two browser clients and the separate Natura process stopped.
- Party's current transport and periodic authority loops are confirmed by source inspection; this review does not claim a production Party availability/load test or that its existing code is fully cheat-proof.
