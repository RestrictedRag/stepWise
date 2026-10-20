// Board script: the JSON the AI "draws". Coordinates live in a 1000×700 virtual canvas.
export const W = 1000, H = 700;
export const COLORS = ["ink", "purple", "orange", "green", "red", "blue"] as const;
export const ICONS = ["crown", "bolt", "star", "check", "cross", "heart", "speech", "fire"] as const;
export type Color = (typeof COLORS)[number];
export type Icon = (typeof ICONS)[number];
type Pt = [number, number];

export type Shape = { color: Color; at?: string } & (
  | { type: "line" | "arrow" | "highlight"; from: Pt; to: Pt }
  | { type: "circle"; x: number; y: number; r: number }
  | { type: "ellipse"; x: number; y: number; rx: number; ry: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "path"; d: string }
  | { type: "text"; x: number; y: number; text: string; size: number }
  | { type: "label"; x: number; y: number; text: string; note: string | null }
  | { type: "icon"; x: number; y: number; name: Icon }
);
export type Step = { say: string; draw: Shape[] };
export type BoardScript = { title: string; subtitle: string | null; steps: Step[] };

const MAX_STEPS = 12, MAX_SHAPES = 8;

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);
const point = (p: unknown): Pt | null => {
  if (!Array.isArray(p)) return null;
  const x = num(p[0], 0, W), y = num(p[1], 0, H);
  return x !== null && y !== null ? [x, y] : null;
};
const SAFE_PATH = /^[MLHVCSQTAZmlhvcsqtaz0-9 ,.\-]{1,2000}$/;

// Returns a cleaned shape, or null to drop it (unknown type or missing fields).
function drawShape(s: any): Shape | null {
  if (!s || typeof s !== "object") return null;
  const { type } = s;
  const color = oneOf(COLORS, s.color) ? s.color : "ink";
  const x = num(s.x, 0, W), y = num(s.y, 0, H);
  const hasXY = x !== null && y !== null;
  switch (type) {
    case "line": case "arrow": case "highlight": {
      const from = point(s.from), to = point(s.to);
      return from && to ? { type, from, to, color } : null;
    }
    case "circle": {
      const r = num(s.r, 1, 350);
      return hasXY && r !== null ? { type, x, y, r, color } : null;
    }
    case "ellipse": {
      const rx = num(s.rx, 1, 500), ry = num(s.ry, 1, 350);
      return hasXY && rx !== null && ry !== null ? { type, x, y, rx, ry, color } : null;
    }
    case "rect": {
      const w = num(s.w, 1, W), h = num(s.h, 1, H);
      return hasXY && w !== null && h !== null ? { type, x, y, w, h, color } : null;
    }
    case "path":
      return typeof s.d === "string" && SAFE_PATH.test(s.d) ? { type, d: s.d, color } : null;
    case "text": {
      const text = str(s.text, 60), size = num(s.size, 16, 72) ?? 30;
      return hasXY && text ? { type, x, y, text, size, color } : null;
    }
    case "label": {
      const text = str(s.text, 40), note = str(s.note, 80);
      return hasXY && text ? { type, x, y, text, note, color } : null;
    }
    case "icon":
      return hasXY && oneOf(ICONS, s.name) ? { type, x, y, name: s.name, color } : null;
    default:
      return null;
  }
}

// Keeps an optional `at` phrase only when it names something the narration actually says.
function shape(s: any, say: string): Shape | null {
  const out = drawShape(s);
  const at = str(s?.at, 60);
  if (out && at && say.toLowerCase().includes(at.toLowerCase())) out.at = at;
  return out;
}

// feTurbulence seed: FNV-1a over the text, folded into 1..9999.
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 9999) + 1;
}

// Padded bounding box of the shapes at the board's 10:7 aspect, at least 60% of W×H, clamped on-board.
export function focusBox(shapes: Shape[]): [number, number, number, number] {
  const pts: Pt[] = [];
  for (const s of shapes as any[]) {
    if (s.type === "line" || s.type === "arrow" || s.type === "highlight") pts.push(s.from, s.to);
    else if (s.type === "circle") pts.push([s.x - s.r, s.y - s.r], [s.x + s.r, s.y + s.r]);
    else if (s.type === "ellipse") pts.push([s.x - s.rx, s.y - s.ry], [s.x + s.rx, s.y + s.ry]);
    else if (s.type === "rect") pts.push([s.x, s.y], [s.x + s.w, s.y + s.h]);
    else if (s.x !== undefined) pts.push([s.x, s.y]); // text, label, icon anchor
  }
  if (!pts.length) return [0, 0, W, H];
  const PAD = 40;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  // Scale unit: 1 unit = 10 px wide, 7 px tall; floor 60 (60% of board), cap 100 (full board).
  const unit = Math.min(W / 10, H / 7, Math.max(60, (maxX - minX + 2 * PAD) / 10, (maxY - minY + 2 * PAD) / 7));
  const w = unit * 10, h = unit * 7;
  const x = Math.min(W - w, Math.max(0, (minX + maxX) / 2 - w / 2));
  const y = Math.min(H - h, Math.max(0, (minY + maxY) / 2 - h / 2));
  return [x, y, w, h];
}

// Untrusted script (model output or fixture) → { script } or { error }. Oversized parts are trimmed, not rejected.
export function parseBoardScript(raw: any): { script: BoardScript; error?: undefined } | { error: string; script?: undefined } {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.steps) || !raw.steps.length) return { error: "Script needs a non-empty steps array." };
  const steps: Step[] = [];
  for (const s of raw.steps.slice(0, MAX_STEPS)) {
    const say = str(s?.say, 300);
    if (!say) return { error: `Step ${steps.length + 1} is missing "say".` };
    const draw = (Array.isArray(s.draw) ? s.draw : []).map((d: any) => shape(d, say)).filter(Boolean).slice(0, MAX_SHAPES);
    steps.push({ say, draw });
  }
  return { script: { title: str(raw.title, 80) ?? "Untitled", subtitle: str(raw.subtitle, 120), steps } };
}
