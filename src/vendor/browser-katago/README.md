# Vendored browser engine

Source: https://github.com/Sir-Teo/web-katrain
Commit: 8dd813aeb565cbdad5215dc75204fc40fd519c50
License: MIT, included in LICENSE and the distributed third-party notices.

Only the dependency closure of src/engine/katago/worker.ts is included.
Relative TypeScript imports have explicit .ts extensions. types.ts contains the
engine-only subset. utils/goRules.ts Chinese rules are adapted to Pluto's
positional superko, no handicap bonus, forbidden suicide, and 6.5 komi.
No application UI, storage, or React code is imported from the upstream project.

The model is g170e-b10c128-s1141046784-d204142634.bin.gz from
https://github.com/lightvector/KataGo/tree/master/cpp/tests/models
KataGo weights are distributed under CC0. This is an older trained model used
by upstream tests, chosen for size and browser speed. It is not the tiny b6
test model nor a claim of native KataGo parity or calibrated playing strength.
