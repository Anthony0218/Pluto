/** Notes: free text and tables, each styled by the person who wrote them. Pure data and storage, no React. */

export const noteFonts = {
  sans: { name: "Sans", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  serif: { name: "Serif", stack: 'Georgia, "Times New Roman", serif' },
  mono: { name: "Monospace", stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  handwriting: { name: "Handwriting", stack: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive' },
  rounded: { name: "Rounded", stack: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif' },
} as const;
export type NoteFont = keyof typeof noteFonts;
export const noteFontIds = Object.keys(noteFonts) as NoteFont[];

export const noteSizes = { small: { name: "Small", px: 14 }, medium: { name: "Medium", px: 16 }, large: { name: "Large", px: 20 }, huge: { name: "Huge", px: 26 } } as const;
export type NoteSize = keyof typeof noteSizes;
export const noteSizeIds = Object.keys(noteSizes) as NoteSize[];

export type NoteStyle = { font: NoteFont; size: NoteSize; /** Text colour. */ color: string; /** Page colour. */ background: string; /** Table headers. */ accent: string };
/** What one block may change on its own; anything left out follows the note. */
export type BlockStyle = { font?: NoteFont; size?: NoteSize; color?: string; bold?: boolean; italic?: boolean };
export type NoteBlock =
  | { id: string; type: "text"; text: string; style?: BlockStyle }
  | { id: string; type: "table"; rows: string[][]; header: boolean; style?: BlockStyle };
export type Note = { id: string; title: string; blocks: NoteBlock[]; style: NoteStyle; createdAt: number; updatedAt: number };

/** Ready-made looks: one click sets the page, text and table colours together. */
export const noteThemes: { id: string; name: string; style: Pick<NoteStyle, "color" | "background" | "accent"> }[] = [
  { id: "midnight", name: "Midnight", style: { color: "#e8edff", background: "#141b34", accent: "#6366f1" } },
  { id: "paper", name: "Paper", style: { color: "#2b2a33", background: "#fbf7ee", accent: "#e9d9a6" } },
  { id: "mint", name: "Mint", style: { color: "#12352b", background: "#dff5ea", accent: "#6ee7b7" } },
  { id: "sunset", name: "Sunset", style: { color: "#fff3e6", background: "#4a2335", accent: "#fb923c" } },
  { id: "lavender", name: "Lavender", style: { color: "#2e2150", background: "#ece6ff", accent: "#a78bfa" } },
  { id: "chalk", name: "Chalkboard", style: { color: "#f1f5f0", background: "#1f2d28", accent: "#facc15" } },
];
export const textSwatches = ["#e8edff", "#2b2a33", "#fca5a5", "#fdba74", "#fde047", "#86efac", "#7dd3fc", "#c4b5fd", "#f9a8d4", "#ffffff"];
export const pageSwatches = ["#141b34", "#fbf7ee", "#dff5ea", "#4a2335", "#ece6ff", "#1f2d28", "#fde9e7", "#e3f0fb", "#000000", "#ffffff"];

export const defaultNoteStyle = (): NoteStyle => ({ font: "sans", size: "medium", ...noteThemes[0].style });

export const limits = { notes: 500, blocks: 200, text: 50000, title: 200, rows: 100, columns: 12, cell: 2000 };

const colour = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const safeId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value);
const stamp = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 4102444800000;

export function newId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; }

export function createTextBlock(text = "", style?: BlockStyle): NoteBlock { return { id: newId(), type: "text", text, ...(style ? { style } : {}) }; }
export function createTableBlock(rows = 3, columns = 3): NoteBlock {
  return { id: newId(), type: "table", header: true, rows: Array.from({ length: Math.min(rows, limits.rows) }, () => Array.from({ length: Math.min(columns, limits.columns) }, () => "")) };
}
export function createNote(blocks: NoteBlock[] = [createTextBlock()], title = "", now = Date.now()): Note {
  return { id: newId(), title, blocks, style: defaultNoteStyle(), createdAt: now, updatedAt: now };
}

function cleanStyle(value: unknown): NoteStyle {
  const base = defaultNoteStyle();
  if (!record(value)) return base;
  return {
    font: noteFontIds.includes(value.font as NoteFont) ? value.font as NoteFont : base.font,
    size: noteSizeIds.includes(value.size as NoteSize) ? value.size as NoteSize : base.size,
    color: colour(value.color) ? value.color : base.color,
    background: colour(value.background) ? value.background : base.background,
    accent: colour(value.accent) ? value.accent : base.accent,
  };
}
function cleanBlockStyle(value: unknown): BlockStyle | undefined {
  if (!record(value)) return undefined;
  const style: BlockStyle = {};
  if (noteFontIds.includes(value.font as NoteFont)) style.font = value.font as NoteFont;
  if (noteSizeIds.includes(value.size as NoteSize)) style.size = value.size as NoteSize;
  if (colour(value.color)) style.color = value.color;
  if (value.bold === true) style.bold = true;
  if (value.italic === true) style.italic = true;
  return Object.keys(style).length ? style : undefined;
}
function cleanBlock(value: unknown): NoteBlock | null {
  if (!record(value) || !safeId(value.id)) return null;
  const style = cleanBlockStyle(value.style);
  if (value.type === "text" && typeof value.text === "string") return { id: value.id, type: "text", text: value.text.slice(0, limits.text), ...(style ? { style } : {}) };
  if (value.type === "table" && Array.isArray(value.rows) && value.rows.length && value.rows.length <= limits.rows) {
    const width = Math.min(limits.columns, Math.max(1, ...value.rows.map(row => Array.isArray(row) ? row.length : 0)));
    const rows = value.rows.map(row => Array.from({ length: width }, (_, column) => Array.isArray(row) && typeof row[column] === "string" ? (row[column] as string).slice(0, limits.cell) : ""));
    return { id: value.id, type: "table", rows, header: value.header !== false, ...(style ? { style } : {}) };
  }
  return null;
}
/** Keeps what is usable: one damaged note or block never costs the rest. */
export function cleanNote(value: unknown): Note | null {
  if (!record(value) || !safeId(value.id) || !Array.isArray(value.blocks)) return null;
  const seen = new Set<string>();
  const blocks = value.blocks.slice(0, limits.blocks).flatMap(item => { const block = cleanBlock(item); if (!block || seen.has(block.id)) return []; seen.add(block.id); return [block]; });
  return {
    id: value.id, title: typeof value.title === "string" ? value.title.slice(0, limits.title) : "", blocks, style: cleanStyle(value.style),
    createdAt: stamp(value.createdAt) ? value.createdAt : 0, updatedAt: stamp(value.updatedAt) ? value.updatedAt : 0,
  };
}
export function parseNotes(raw: string | null): Note[] {
  try {
    if ((raw?.length ?? 0) > 4500000) return [];
    const data: unknown = JSON.parse(raw ?? "null");
    if (!record(data) || data.version !== 1 || !Array.isArray(data.notes)) return [];
    const seen = new Set<string>();
    return data.notes.slice(0, limits.notes).flatMap(item => { const note = cleanNote(item); if (!note || seen.has(note.id)) return []; seen.add(note.id); return [note]; });
  } catch { return []; }
}

/** Newest edit first. */
export const sortNotes = (notes: readonly Note[]) => [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
export const noteTitle = (note: Pick<Note, "title" | "blocks">) => note.title.trim() || firstLine(note) || "";
function firstLine(note: Pick<Note, "blocks">) {
  for (const block of note.blocks) if (block.type === "text") { const line = block.text.split("\n").find(item => item.trim()); if (line) return line.trim().slice(0, 60); }
  return "";
}
export function noteSnippet(note: Pick<Note, "blocks">) {
  const parts: string[] = [];
  for (const block of note.blocks) {
    if (block.type === "text") parts.push(block.text.replace(/\s+/g, " ").trim());
    else parts.push(block.rows.slice(0, 2).map(row => row.filter(Boolean).join(" · ")).filter(Boolean).join(" / "));
  }
  return parts.filter(Boolean).join(" · ").slice(0, 120);
}
export function matchesQuery(note: Note, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const text = [note.title, ...note.blocks.map(block => block.type === "text" ? block.text : block.rows.flat().join(" "))].join("\n").toLowerCase();
  return text.includes(needle);
}

/** Black or white, whichever reads better on a colour. */
export function readableOn(hex: string) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000";
  const [r, g, b] = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255).map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0b1020" : "#ffffff";
}
/** What one block looks like: its own choices first, then the note's. */
export function effectiveStyle(note: NoteStyle, block?: BlockStyle) {
  return { font: block?.font ?? note.font, size: block?.size ?? note.size, color: block?.color ?? note.color, bold: !!block?.bold, italic: !!block?.italic };
}

// Table edits return a new table and never go past the limits.
export const tableAddRow = (rows: string[][]) => rows.length >= limits.rows ? rows : [...rows, Array.from({ length: rows[0]?.length ?? 1 }, () => "")];
export const tableAddColumn = (rows: string[][]) => (rows[0]?.length ?? 0) >= limits.columns ? rows : rows.map(row => [...row, ""]);
export const tableRemoveRow = (rows: string[][], index: number) => rows.length <= 1 ? rows : rows.filter((_, position) => position !== index);
export const tableRemoveColumn = (rows: string[][], index: number) => (rows[0]?.length ?? 0) <= 1 ? rows : rows.map(row => row.filter((_, position) => position !== index));
export const tableSetCell = (rows: string[][], row: number, column: number, value: string) => rows.map((cells, r) => r === row ? cells.map((cell, c) => c === column ? value.slice(0, limits.cell) : cell) : cells);

/** Moves a block one place up (-1) or down (1). */
export function moveBlock(blocks: NoteBlock[], id: string, direction: -1 | 1) {
  const from = blocks.findIndex(block => block.id === id), to = from + direction;
  if (from < 0 || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** A calculation to keep: a short heading and the lines under it, as one text block. */
export function resultBlock(heading: string, lines: readonly string[]): NoteBlock {
  return createTextBlock([heading, ...lines].filter(Boolean).join("\n"));
}

export function createNotesStore(storage: Pick<Storage, "getItem" | "setItem"> | null) {
  const prefix = "pluto-notes-v1:", cache = new Map<string, { raw: string | null; notes: Note[] }>(), volatile = new Set<string>(), listeners = new Map<string, Set<() => void>>();
  const notify = (account: string) => listeners.get(account)?.forEach(fn => fn());
  function read(account: string): Note[] {
    const previous = cache.get(account);
    if (previous && volatile.has(account)) return previous.notes;
    let raw: string | null;
    try { if (!storage) throw Error("Unavailable"); raw = storage.getItem(prefix + account); }
    catch { volatile.add(account); if (previous) return previous.notes; raw = null; }
    if (previous && previous.raw === raw) return previous.notes;
    const notes = parseNotes(raw);
    cache.set(account, { raw, notes });
    return notes;
  }
  function write(account: string, notes: Note[]) {
    if (notes.length > limits.notes) return false;
    const raw = JSON.stringify({ version: 1, notes });
    if (raw.length > 4500000) return false;
    cache.set(account, { raw, notes });
    try { if (!storage) throw Error("Unavailable"); storage.setItem(prefix + account, raw); } catch { volatile.add(account); }
    notify(account);
    return true;
  }
  return {
    read,
    /** Adds the note, or replaces the one with the same id. */
    save(account: string, note: Note) {
      const clean = cleanNote(note);
      if (!clean) return false;
      const notes = read(account);
      return write(account, notes.some(item => item.id === clean.id) ? notes.map(item => item.id === clean.id ? clean : item) : [clean, ...notes]);
    },
    remove(account: string, id: string) { return write(account, read(account).filter(note => note.id !== id)); },
    /** Appends blocks to a note, or starts a new one when `id` is missing or gone. Returns the note's id. */
    append(account: string, id: string | null, blocks: NoteBlock[], title = "", now = Date.now()) {
      const notes = read(account), existing = id ? notes.find(note => note.id === id) : undefined;
      if (!existing) { const note = createNote(blocks, title, now); return this.save(account, note) ? note.id : null; }
      const merged = { ...existing, blocks: [...existing.blocks, ...blocks].slice(0, limits.blocks), updatedAt: now };
      return this.save(account, merged) ? existing.id : null;
    },
    isVolatile: (account: string) => volatile.has(account),
    subscribe(account: string, fn: () => void) { const group = listeners.get(account) ?? new Set(); group.add(fn); listeners.set(account, group); return () => { group.delete(fn); if (!group.size) listeners.delete(account); }; },
    sync(key: string | null) { for (const account of cache.keys()) if ((key === null || key === prefix + account) && !volatile.has(account)) { read(account); notify(account); } },
  };
}
