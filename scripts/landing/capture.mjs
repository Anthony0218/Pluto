// Landing-page screenshot regression check.
//
//   node scripts/landing/capture.mjs            capture the current page and compare with the baseline
//   node scripts/landing/capture.mjs --update   capture and store the shots as the new baseline
//
// Options: --url=http://localhost:5173  --chrome=/path/to/chrome  --tolerance=0.02  --only=hero,chess
// Needs a running dev server (or preview) and a local Chrome/Chromium. It drives Chrome over the DevTools protocol
// with the `ws` package that is already a dependency, so nothing extra is installed. CSS animations and transitions
// are frozen (and the WebGL clock stopped via data-still) so the shots are repeatable; scroll-linked motion and the WebGL scene are real, hence a small tolerance.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import WebSocket from "ws";

const root = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, value = "true"] = arg.replace(/^--/, "").split("="); return [key, value]; }));
const url = args.url ?? "http://localhost:5173";
const update = "update" in args;
const tolerance = Number(args.tolerance ?? 0.02); // share of pixels allowed to differ
const channelTolerance = 28;                       // per-channel difference that still counts as the same pixel
const baselineDir = path.join(root, "baseline");
const outputDir = path.join(root, "output");

const viewports = [
  { name: "360", width: 360, height: 740, scale: 2, mobile: true },
  { name: "390", width: 390, height: 844, scale: 2, mobile: true },
  { name: "768", width: 768, height: 1024, scale: 1, mobile: false },
  { name: "1024", width: 1024, height: 768, scale: 1, mobile: false },
  { name: "1440", width: 1440, height: 900, scale: 1, mobile: false },
  { name: "1440-zoom200", width: 720, height: 450, scale: 2, mobile: false }, // 200% browser zoom
];
// Where to scroll: a section id, the pinned flyby, or the very top.
const stops = [
  { name: "hero", at: "top" },
  { name: "flyby", at: "flyby" },
  { name: "chess", at: "chess" },
  { name: "go", at: "go" },
  { name: "tools", at: "tools" },
  { name: "closing", at: "start" },
];
const only = args.only?.split(",");

function findChrome() {
  const candidates = [args.chrome, process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"];
  const found = candidates.find(candidate => candidate && existsSync(candidate));
  if (!found) throw new Error("No Chrome found. Pass --chrome=/path/to/chrome or set CHROME_PATH.");
  return found;
}

// ── A very small DevTools client ──
async function launch() {
  const profile = mkdtempSync(path.join(tmpdir(), "pluto-shots-"));
  const port = 9222 + Math.floor(Math.random() * 500);
  const chrome = spawn(findChrome(), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "--hide-scrollbars", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" });
  let target;
  for (let attempt = 0; attempt < 60 && !target; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 250));
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(item => item.type === "page"); } catch { /* still starting */ }
  }
  if (!target) throw new Error("Chrome did not start");
  const socket = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.on("message", data => { const message = JSON.parse(data); if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text); if (message.method === "Network.responseReceived" && message.params.response.status >= 400) errors.push(`${message.params.response.status} ${message.params.response.url}`); if (message.method === "Log.entryAdded" && message.params.entry.level === "error") errors.push(message.params.entry.text); if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  const close = async () => {
    socket.close();
    const exited = new Promise(resolve => chrome.once("exit", resolve));
    chrome.kill();
    await Promise.race([exited, sleep(5000)]);
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* a temp folder left behind is harmless */ }
  };
  return { send, close, errors };
}

const evaluate = async (client, expression) => (await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(client, expression, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await evaluate(client, `Boolean(${expression})`)) return true; } catch { /* navigating */ }
    await sleep(500);
  }
  return false;
}

const freezeCss = "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }";
const scrollTo = (at) => `(async () => {
  const viewport = document.querySelector('.app-viewport');
  if (!viewport) return 'no viewport';
  const origin = () => viewport.getBoundingClientRect().top - viewport.scrollTop;
  if (${JSON.stringify(at)} === 'top') viewport.scrollTop = 0;
  else if (${JSON.stringify(at)} === 'flyby') {
    const flyby = document.querySelector('[data-journey-flyby]');
    if (!flyby) return 'no flyby';
    viewport.scrollTop = flyby.getBoundingClientRect().top - origin() + (flyby.offsetHeight - viewport.clientHeight) * 0.55;
  } else {
    const section = document.getElementById(${JSON.stringify(at)});
    if (!section) return 'no section';
    const rect = section.getBoundingClientRect();
    viewport.scrollTop = rect.top - origin() + rect.height / 2 - viewport.clientHeight / 2;
  }
  await new Promise(resolve => setTimeout(resolve, 1400));
  // Lazy demos show a skeleton until their chunk arrives; wait for them so the shot is the finished page.
  for (let i = 0; i < 40 && document.querySelector('.demo-skeleton'); i++) await new Promise(resolve => setTimeout(resolve, 250));
  await new Promise(resolve => setTimeout(resolve, 400));
  return 'ok';
})()`;

// ── PNG comparison (8-bit, non-interlaced, as Chrome writes them) ──
function decodePng(buffer) {
  let offset = 8, width = 0, height = 0, channels = 4;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString("ascii", offset + 4, offset + 8), data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = { 2: 3, 6: 4 }[data[9]] ?? 4; }
    if (type === "IDAT") chunks.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels, pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), out = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[out + x - channels] : 0, up = y ? pixels[out - stride + x] : 0, upLeft = y && x >= channels ? pixels[out - stride + x - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : (() => { const p = left + up - upLeft, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft); return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft; })();
      pixels[out + x] = (line[x] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}

function difference(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let different = 0;
  const total = a.width * a.height;
  for (let pixel = 0; pixel < total; pixel++) {
    for (let channel = 0; channel < 3; channel++) {
      if (Math.abs(a.pixels[pixel * a.channels + channel] - b.pixels[pixel * b.channels + channel]) > channelTolerance) { different++; break; }
    }
  }
  return different / total;
}

// ── Run ──
mkdirSync(update ? baselineDir : outputDir, { recursive: true });
const client = await launch();
const failures = [];
let compared = 0;
try {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Network.enable");
  for (const viewport of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale, mobile: viewport.mobile });
    await client.send("Page.navigate", { url });
    // The dev server serves hundreds of modules, so wait for the landing page itself rather than a fixed delay.
    const ready = await waitFor(client, "document.querySelector('.app-viewport [data-journey-stop]') && document.fonts.status === 'loaded'", 60000);
    if (!ready) {
      const state = await evaluate(client, `JSON.stringify({ title: document.title, ready: document.readyState, fonts: document.fonts.status, viewport: !!document.querySelector('.app-viewport'), stops: document.querySelectorAll('[data-journey-stop]').length, text: document.body.innerText.slice(0, 160) })`).catch(error => String(error));
      throw new Error(`The landing page did not appear at ${url} within 60 seconds. Is the dev server running? Page state: ${state}${client.errors.length ? `\nPage errors:\n${client.errors.slice(0, 4).join("\n")}` : ""}`);
    }
    await sleep(1500);
    await evaluate(client, `(() => { const style = document.createElement('style'); style.textContent = ${JSON.stringify(freezeCss)}; document.head.append(style); document.documentElement.dataset.still = ''; })()`);
    for (const stop of stops) {
      if (only && !only.includes(stop.name)) continue;
      const result = await evaluate(client, scrollTo(stop.at));
      if (result !== "ok") { console.log(`skip  ${viewport.name}/${stop.name} (${result})`); continue; }
      const { data } = await client.send("Page.captureScreenshot", { format: "png" });
      const file = `${viewport.name}-${stop.name}.png`;
      const png = Buffer.from(data, "base64");
      if (update) { writeFileSync(path.join(baselineDir, file), png); console.log(`saved ${file}`); continue; }
      writeFileSync(path.join(outputDir, file), png);
      const baseline = path.join(baselineDir, file);
      if (!existsSync(baseline)) { console.log(`new   ${file} (no baseline yet)`); continue; }
      const changed = difference(decodePng(readFileSync(baseline)), decodePng(png));
      compared++;
      const verdict = changed <= tolerance ? "ok   " : "DIFF ";
      console.log(`${verdict} ${file}  ${(changed * 100).toFixed(2)}% of pixels differ`);
      if (changed > tolerance) failures.push(file);
    }
  }
} finally {
  await client.close();
}
if (update) console.log(`Baseline written to ${baselineDir}`);
else if (failures.length) { console.error(`\n${failures.length} of ${compared} screenshots changed beyond ${(tolerance * 100).toFixed(1)}%. Compare ${outputDir} with ${baselineDir}.`); process.exitCode = 1; }
else console.log(`\n${compared} screenshots match the baseline.${readdirSync(baselineDir).length ? "" : " (No baseline found: run with --update first.)"}`);
