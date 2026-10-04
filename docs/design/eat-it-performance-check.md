# Eat It performance check — 2026-10-04

The development fixture at `/tests/eat-it-performance-preview.html` runs the actual engine and Three.js renderer with eight players and normal object populations. It supports all four maps and starting/large characters, reports RAF frame intervals separately from simulation/render CPU time, warms up for three seconds, measures for fifteen seconds, then stops rendering and simulating. The viewport is the canvas size, excluding fixture controls.

Observed City baseline on this computer:

| Canvas | Objects | FPS | Frame p95 | Simulation p95 | Render CPU p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1280 × 570 | 919 | 27.3 | 50.1 ms | 8.5 ms | 9.2 ms |
| 390 × 694 | 919 | 32.1 | 50.0 ms | 12.6 ms | 14.0 ms |

The phone-size run had 764 draw calls at the final sample. These figures show stutter in this development session, but **are not real-phone measurements**. They include the desktop app's browser and the computer's other workloads. Process inspection and test-duration variation confirmed substantial competing work; browser controls also repeatedly timed out.

A temporary experiment removed tiny-snack shadows and cached shadow eligibility. The phone-size result was 30.0 FPS, 50.2 ms frame p95, 17.7 ms simulation p95, 15.7 ms render CPU p95, 692 draw calls. Although draw calls decreased, the CPU timings worsened across the whole game; this does not establish an FPS improvement. The tiny-shadow removal was reverted.

The retained changes cache prop shadow eligibility instead of walking every prop's mesh hierarchy every frame, and reduce excess offscreen rendering padding from 220 to 48 world units while retaining each prop's footprint/height allowance. Camera zoom, visual shadows, and ordinary spawn density stay the same. Browser timeouts prevented a final comparable FPS measurement. All four maps and large-character scenarios still need an uncontended browser run; physical mobile hardware still needs testing.
