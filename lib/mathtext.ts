import katex from "katex";

const MATH =
  /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|(?<!\$)\$([^\s\n$](?:[^\n$]*?[^\s\n$])?)\$(?!\d)/g;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const inline = (s: string) =>
  s
    .replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^\s*\n](?:[^\n*]*[^\s*\n])?)\*(?!\*)/g, "$1<em>$2</em>");

// Model text → safe HTML: math extracted to placeholders first, remaining text escaped, then markdown blocks & bold/italic applied.
// shortcut: no nested lists, no tables, no code blocks, no links; add when the model starts emitting them.
export function mathText(src: string): string {
  const math: string[] = [];
  const isDisplay: boolean[] = [];
  const clean = src.replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
  const text = clean.replace(MATH, (_, block, dollars, inlineBracket, inlineDollar) => {
    const display = block !== undefined || dollars !== undefined;
    math.push(
      katex.renderToString(block ?? dollars ?? inlineBracket ?? inlineDollar, {
        displayMode: display,
        throwOnError: false,
      }),
    );
    isDisplay.push(display);
    return `\u0000${math.length - 1}\u0000`;
  });

  const out: string[] = [];
  let para: string[] = [];
  let listTag: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p class="md-p">${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!listTag) return;
    out.push(
      `<${listTag} class="md-${listTag}">${listItems.map((item) => `<li>${inline(item)}</li>`).join("")}</${listTag}>`,
    );
    listTag = null;
    listItems = [];
  };

  for (const line of esc(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    const displayMatch = trimmed.match(/^\u0000(\d+)\u0000$/);
    if (displayMatch && isDisplay[+displayMatch[1]]) {
      flushPara();
      flushList();
      out.push(trimmed);
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      out.push(`<h3 class="md-h">${inline(heading[1].trim())}</h3>`);
      continue;
    }

    const ul = line.match(/^[*-]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (listTag && listTag !== "ul") flushList();
      listTag = "ul";
      listItems.push(ul[1]);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listTag && listTag !== "ol") flushList();
      listTag = "ol";
      listItems.push(ol[1]);
      continue;
    }

    flushList();
    para.push(line);
  }

  flushPara();
  flushList();

  return out.join("").replace(/\u0000(\d+)\u0000/g, (_, n) => math[+n]);
}
