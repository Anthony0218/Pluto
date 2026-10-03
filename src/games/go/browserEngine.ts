import type { GoState } from "./rules";
import { scoreGo } from "./rules";
import type { GoAnalysis } from "./analysis";
import type { KataGoWorkerResponse } from "../../vendor/browser-katago/engine/katago/types";
import { browserGoRequest, browserGoResult } from "./browserProtocol";

let worker: Worker | null = null;
let sequence = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<number, { state: GoState; resolve: (result: GoAnalysis) => void; reject: (error: Error) => void; cleanup: () => void }>();
const cache = new Map<string, GoAnalysis>();
function stop(error: Error) {
  worker?.terminate(); worker = null; clearTimeout(idleTimer);
  for (const job of pending.values()) { job.cleanup(); job.reject(error); }
  pending.clear();
}
function getWorker() {
  clearTimeout(idleTimer);
  if (worker) return worker;
  worker = new Worker(new URL("../../vendor/browser-katago/engine/katago/worker.ts", import.meta.url), { type: "module" });
  worker.onerror = () => stop(new Error("The browser Go engine could not start. Reload and try again."));
  worker.onmessageerror = () => stop(new Error("The browser Go engine returned unreadable data."));
  worker.onmessage = (event: MessageEvent<KataGoWorkerResponse>) => {
    const message = event.data;
    if (message.type !== "katago:analyze_result") return;
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id); job.cleanup();
    if (!message.ok || !message.analysis) job.reject(new Error(message.error ?? "Browser analysis failed. Please retry."));
    else {
      try { job.resolve(browserGoResult(job.state, message.analysis)); }
      catch (error) { job.reject(error instanceof Error ? error : new Error("Invalid analysis")); }
    }
    if (!pending.size) idleTimer = setTimeout(() => stop(new Error("Engine released")), 120000);
  };
  return worker;
}
export async function analyzeInBrowser(state: GoState, signal?: AbortSignal): Promise<GoAnalysis> {
  if (signal?.aborted) throw new DOMException("Analysis cancelled", "AbortError");
  if (state.status === "finished" && state.consecutivePasses >= 2) {
    const score = scoreGo(state), lead = score.black - score.white;
    return { turnNumber: state.moveHistory.length, rootInfo: { scoreLead: lead, winrate: lead === 0 ? .5 : lead > 0 ? 1 : 0, visits: 0 }, moveInfos: [] };
  }
  const key = JSON.stringify([state.boardSize, state.komi, state.moveHistory]);
  const cached = cache.get(key); if (cached) return cached;
  const id = ++sequence;
  const result = await new Promise<GoAnalysis>((resolve, reject) => {
    const engine = getWorker();
    const abort = () => {
      const job = pending.get(id); if (!job) return;
      pending.delete(id); job.cleanup();
      engine.postMessage({ type: "katago:cancel", id, analysisGroup: "interactive" });
      reject(new DOMException("Analysis cancelled", "AbortError"));
      if (!pending.size) idleTimer = setTimeout(() => stop(new Error("Engine released")), 120000);
    };
    const timer = setTimeout(() => stop(new Error("Browser analysis timed out. Please retry.")), 120000);
    pending.set(id, { state, resolve, reject, cleanup: () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); } });
    signal?.addEventListener("abort", abort, { once: true });
    try {
      engine.postMessage(browserGoRequest(state, id, new URL(import.meta.env.BASE_URL + "go-engine/katago-b10.bin.gz", location.origin).href));
    } catch (error) {
      pending.get(id)?.cleanup();
      pending.delete(id);
      reject(error instanceof Error ? error : new Error("Could not start browser analysis"));
      if (!pending.size) idleTimer = setTimeout(() => stop(new Error("Engine released")), 120000);
    }
  });
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
