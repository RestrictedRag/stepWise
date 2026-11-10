// Checks a model-written SVG before it is sent to the board.
// The board shows it through <img>, where the browser runs no script and loads no outside file.
// This check is the second layer and also catches replies that are not a usable drawing.

const MAX_CHARS = 20000;

const ALLOWED_TAGS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "defs", "marker", "title", "desc",
]);

export function sanitizeDiagramSvg(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;

  let svg = match[0].replace(/<!--[\s\S]*?-->/g, "");
  if (svg.length > MAX_CHARS) return null;

  // Doctype, CDATA, processing instructions, entity declarations
  if (/<[!?]/.test(svg)) return null;

  // Every tag must be on the allow-list
  for (const m of svg.matchAll(/<\/?\s*([A-Za-z][\w:.-]*)/g)) {
    if (!ALLOWED_TAGS.has(m[1].toLowerCase())) return null;
  }

  // Event handlers
  if (/\son[a-z]+\s*=/i.test(svg)) return null;

  // Links: only same-document fragments
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*(["'])([\s\S]*?)\1/gi)) {
    if (!m[2].trim().startsWith("#")) return null;
  }

  // url(...): only same-document fragments
  for (const m of svg.matchAll(/url\(\s*(["']?)([^)]*?)\1\s*\)/gi)) {
    if (!m[2].trim().startsWith("#")) return null;
  }

  if (/javascript:|@import|expression\(/i.test(svg)) return null;

  const openTag = svg.match(/<svg[^>]*>/i)![0];
  if (!/\sviewBox\s*=/i.test(openTag)) return null;

  // <img> only renders an SVG that declares the namespace
  if (!/\sxmlns\s*=/i.test(openTag)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // A drawing needs some drawing
  const marks = svg.match(/<(path|rect|circle|ellipse|line|polyline|polygon)\b/gi);
  if (!marks || marks.length < 3) return null;

  return svg;
}

