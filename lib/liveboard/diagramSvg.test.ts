import { test } from "node:test";
import assert from "node:assert";
import { sanitizeDiagramSvg } from "./diagramSvg.ts";

const GOOD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700">
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#c00"/></marker></defs>
<path d="M500 620 C200 420 220 160 400 160 C460 160 500 200 500 240 C500 200 540 160 600 160 C780 160 800 420 500 620 Z" fill="none" stroke="#222" stroke-width="2.5"/>
<line x1="500" y1="240" x2="500" y2="600" stroke="#222" stroke-width="2.5"/>
<path d="M420 300 L420 460" stroke="#c00" stroke-width="2.5" marker-end="url(#arrow)"/>
<text x="330" y="280" font-family="sans-serif" font-size="24" fill="#222">Right atrium</text>
</svg>`;

test("accepts valid SVG starting with <svg", () => {
  const out = sanitizeDiagramSvg(GOOD);
  assert.ok(out && out.startsWith("<svg"));
});

test("extracts SVG wrapped in prose and fences", () => {
  assert.equal(sanitizeDiagramSvg("Here you go:\n```svg\n" + GOOD + "\n```"), GOOD);
});

test("injects xmlns when omitted on <svg>", () => {
  const noXmlns = GOOD.replace('xmlns="http://www.w3.org/2000/svg" ', "");
  const out = sanitizeDiagramSvg(noXmlns);
  assert.ok(out && out.includes('xmlns="http://www.w3.org/2000/svg"'));
});

test("rejects <script> elements", () => {
  assert.equal(sanitizeDiagramSvg(GOOD.replace("</svg>", "<script>alert(1)</script></svg>")), null);
});

test("rejects inline event handlers", () => {
  assert.equal(sanitizeDiagramSvg(GOOD.replace("<svg", '<svg onload="x()"')), null);
});

test("rejects external <image> href", () => {
  assert.equal(sanitizeDiagramSvg(GOOD.replace("</svg>", '<image href="https://example.com/a.png"/></svg>')), null);
});

test("rejects external url() reference", () => {
  assert.equal(
    sanitizeDiagramSvg(GOOD.replace("</svg>", '<path d="M0 0" style="fill:url(https://example.com/x)"/></svg>')),
    null
  );
});

test("rejects <foreignObject>", () => {
  assert.equal(sanitizeDiagramSvg(GOOD.replace("</svg>", "<foreignObject></foreignObject></svg>")), null);
});

test("rejects missing viewBox", () => {
  assert.equal(sanitizeDiagramSvg(GOOD.replace(' viewBox="0 0 1000 700"', "")), null);
});

test("rejects plain text", () => {
  assert.equal(sanitizeDiagramSvg("I cannot draw that."), null);
});

test("rejects SVG with fewer than 3 shape marks", () => {
  assert.equal(
    sanitizeDiagramSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="1"/></svg>'),
    null
  );
});

test("rejects oversized SVG", () => {
  assert.equal(sanitizeDiagramSvg("<svg>" + "x".repeat(20001) + "</svg>"), null);
});

test("rejects non-string input", () => {
  assert.equal(sanitizeDiagramSvg(42), null);
});

