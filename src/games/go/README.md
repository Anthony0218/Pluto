# Browser Go analysis

Go review, hints and the singleplayer opponent run in a Web Worker, like the
chess Stockfish integration. No analysis API, Render service, native KataGo
installation, Supabase function, migration, or cross-origin isolation is needed.
Deploy the normal frontend build.

The browser engine is the MIT-licensed Web KaTrain TypeScript/TensorFlow.js
implementation of KataGo model evaluation and MCTS, not the native KataGo binary.
It prefers WebGPU, falls back to WebAssembly, then JavaScript CPU. The UI stays
on the main thread. Search is capped at 64 visits and three seconds after model
initialization. First use downloads the bundled 10.6 MiB b10 model and worker.
The browser caches static assets normally; this is not a full offline PWA.

The b10 model is a compact older trained network, not a current full-strength
model. Review estimates and point-loss bands are coaching guidance, not ranks.
Search speed and achieved visits vary by device. Model loading has a two-minute
deadline; cancellation stops search, cached results are bounded, and an idle
worker is released after two minutes.

## Assets and build

- public/go-engine/katago-b10.bin.gz is committed with the site.
- predev/prebuild copy the installed TensorFlow WASM binaries into public/tfjs.
- All model/WASM requests stay on the website's origin.
- npm run build produces everything needed in dist.
- npm run preview serves the static build, without an analysis backend.

The adapter supplies full repetition history, previous boards, and recent moves.
The vendored Chinese rules entry is adapted to this app: positional superko,
area scoring, no suicide, no handicap bonus, 6.5 komi, and capture dead stones
before passing. Engine candidates and variations are checked against the app's
rules. Finished games after two passes use the exact local area score.

See src/vendor/browser-katago/README.md for source provenance and modifications.
