import katex from "katex";

const MATH = /\s*\\\[([\s\S]+?)\\\]\s*|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)/g;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Model text → safe HTML: LaTeX via KaTeX, **bold**, everything else escaped. Unclosed math (mid-stream) stays as text.
// shortcut: no single-$ inline math (clashes with prices), add it if models start using $x$.
export function mathText(src: string): string {
  const math: string[] = [];
  const text = src.replace(MATH, (_, block, dollars, inline) => {
    const display = inline === undefined;
    math.push(katex.renderToString(block ?? dollars ?? inline, { displayMode: display, throwOnError: false }));
    return `\u0000${math.length - 1}\u0000`;
  });
  return esc(text)
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\u0000(\d+)\u0000/g, (_, n) => math[+n]);
}
