# 3D Chess migration checklist

The former `/games/chess/3dchess` pages used `chess.js` for rules and a separate game state. Chess Custom now owns their playable preset and all custom variant rules. The old URLs redirect into Chess Custom.

| Former feature | Migration |
| --- | --- |
| 8×8 starting position and classic rules | Editable `3d-chess` preset in `src/games/chess/custom/engine/presets.ts` |
| Three.js board and piece models | Shared `src/components/chess3d/Board3DScene.tsx` and existing model assets, now rendered per layer |
| Board and piece materials | Existing Chess 3D assets and themes retained |
| Orbit, pan, zoom and camera presets | Shared 3D scene and Chess Custom simulation controls |
| Move effects, highlights and chess sounds | Shared scene effects plus `chessAudio` in simulation and online play |
| Singleplayer AI | Chess Custom random, greedy and search agents, all choosing engine legal moves |
| Local play | Chess Custom simulation with human controllers for both teams |
| Online play | Private Chess Custom rooms using the shared engine in a Supabase Edge Function |
| Legacy links | `/games/chess/3dchess`, `/hotseat`, and `/ai` redirect to the preset and matching play mode |
| Saved variants | Schema 1 documents migrate to schema 2 with all existing pieces on layer 0 |

The old 3D Chess pages, board wrapper and difficulty mapping were removed after their useful presentation code and behavior were moved to Chess Custom. The former game had no separate online match or saved-game format to migrate.

## Online deployment

Online rooms require the migrations `supabase/migrations/20261005000000_chess_custom_matches.sql` and `supabase/migrations/20261011000000_chess_custom_four_player_matches.sql` plus the `chess-custom-match` Edge Function to be deployed to the project's Supabase instance. The function uses the service role key and must retain JWT verification. The migrations deny direct client access to the room table; moves go through the function, where the canonical variant hash and legal move are checked before state is updated.

After deployment, create a room as one signed-in user, join it as a second signed-in user, make a cross-layer move, and reload each client to verify the same variant, position, turn and history are restored. This live two-client check remains outstanding in the local development environment.

For Pluto Team Chess and Team Chess Long Edition, repeat with four signed-in users. Confirm seats follow White → Red → Black → Blue, the room starts only after the fourth joins, and only the current team's player can move.
