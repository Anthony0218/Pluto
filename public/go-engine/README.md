# Browser Go engine assets

Web KaTrain engine: https://github.com/Sir-Teo/web-katrain
Source commit: 8dd813aeb565cbdad5215dc75204fc40fd519c50
Copyright (c) 2026 Web KatRain Contributors. MIT license in Web-KaTrain-LICENSE.txt.
Local changes adapt Chinese rules to positional superko without handicap bonus,
adjust TypeScript imports, and retain only worker dependencies and types.

TensorFlow.js 4.22.0: https://github.com/tensorflow/tfjs
Copyright Google LLC. Apache 2.0 license in TensorFlow-LICENSE.txt.
WASM binaries are copied without modification from the installed npm package.

Pako 2.1.0: https://github.com/nodeca/pako
Copyright Vitaly Puzrin and Andrei Tuputcyn. See pako-LICENSE.txt.

KataGo model: g170e-b10c128-s1141046784-d204142634.bin.gz
Source: https://github.com/lightvector/KataGo/tree/master/cpp/tests/models
KataGo neural network weights are released under CC0:
https://github.com/lightvector/KataGo#license
https://creativecommons.org/publicdomain/zero/1.0/
SHA-256: 1a8e05a4ea3fca20dab79410cbb566c760767fcdd2fa0b701cfe259a84cc8b04

The compact older b10 network is used for local coaching estimates. This browser
implementation is not the native KataGo executable or a full-strength deployment.
