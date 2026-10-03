import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const require = createRequire(import.meta.url);
const source = dirname(require.resolve("@tensorflow/tfjs-backend-wasm/package.json"));
const target = new URL("../../public/tfjs/", import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(new URL("../../src/vendor/browser-katago/LICENSE", import.meta.url), new URL("../../public/go-engine/Web-KaTrain-LICENSE.txt", import.meta.url));
await copyFile(resolve(dirname(require.resolve("pako/package.json")), "LICENSE"), new URL("../../public/go-engine/pako-LICENSE.txt", import.meta.url));
for (const name of ["tfjs-backend-wasm.wasm", "tfjs-backend-wasm-simd.wasm", "tfjs-backend-wasm-threaded-simd.wasm"]) {
  await copyFile(resolve(source, "dist", name), new URL(name, target));
}
