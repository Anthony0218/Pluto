// Concise structured server log: `2026-09-30T12:00:00.000Z INFO match.start code=PLUTO-123456 map=sunspill`.
// Never pass session tokens or other secrets as fields: player ids and lobby codes are the identifiers.
type Level = "debug" | "info" | "warn" | "error" | "silent";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const fromEnv = process.env.PARTY_LOG_LEVEL as Level | undefined;
// The node test runner sets NODE_TEST_CONTEXT; keep test output readable unless asked otherwise.
let level: Level =
  fromEnv && fromEnv in ORDER ? fromEnv : process.env.NODE_TEST_CONTEXT ? "warn" : "info";
export function setLogLevel(next: Level) {
  level = next;
}
type Fields = Record<string, string | number | boolean | null | undefined>;
function write(at: Level, event: string, fields: Fields = {}) {
  if (ORDER[at] < ORDER[level]) return;
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" && /\s/.test(v) ? JSON.stringify(v) : v}`);
  const line = `${new Date().toISOString()} ${at.toUpperCase()} ${event}${parts.length ? " " + parts.join(" ") : ""}`;
  if (at === "error") console.error(line);
  else if (at === "warn") console.warn(line);
  else console.log(line);
}
export const log = {
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
// Multi-line detail (a stack trace) at error level; respects the configured level.
export function logStack(stack: string | undefined) {
  if (stack && ORDER.error >= ORDER[level]) console.error(stack);
}
