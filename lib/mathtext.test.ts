import { test } from "node:test";
import assert from "node:assert";
import { mathText } from "./mathtext.ts";

test("renders math and bold, escapes plain text", () => {
  const html = mathText("**Step 1: find \\(n\\)**\n\\[\n\\int x^2\\,dx\n\\]\n<b>x</b>");
  assert.match(html, /^<p class="md-p"><strong>Step 1: find <span class="katex">/);
  assert.match(html, /<\/strong><\/p><span class="katex-display">/);
  assert.match(html, /<p class="md-p">&#60;b&#62;x&#60;\/b&#62;<\/p>$/);
});

test("renders single-dollar inline math with KaTeX", () => {
  const html = mathText("$s$ and $v = u + at$");
  assert.ok(html.includes('class="katex"'));
  assert.ok(!html.includes("$"));
  assert.ok(!html.includes("katex-display"));
});

test("leaves price dollars unchanged as plain text", () => {
  const html = mathText("costs $5 and $10");
  assert.equal(html, '<p class="md-p">costs $5 and $10</p>');
  assert.ok(!html.includes('class="katex"'));
});

test("renders $$...$$ in display mode on its own without <p>", () => {
  const html = mathText("$$x^2$$");
  assert.ok(html.includes("katex-display"));
  assert.ok(!html.includes("<p"));
});

test("renders ### heading as <h3 class=\"md-h\">", () => {
  const html = mathText("### Title");
  assert.equal(html, '<h3 class="md-h">Title</h3>');
});

test("groups consecutive * bullets into one <ul class=\"md-ul\">", () => {
  const html = mathText("* a\n* b");
  assert.equal(html, '<ul class="md-ul"><li>a</li><li>b</li></ul>');
});

test("groups consecutive numbered items into one <ol class=\"md-ol\">", () => {
  const html = mathText("1. a\n2. b");
  assert.equal(html, '<ol class="md-ol"><li>a</li><li>b</li></ol>');
});

test("renders *italic* as <em> and **bold** as <strong>", () => {
  const html = mathText("*note* and **b**");
  assert.equal(html, '<p class="md-p"><em>note</em> and <strong>b</strong></p>');
});

test("splits paragraphs on blank lines and joins single newlines with <br>", () => {
  assert.equal(mathText("a\n\nb"), '<p class="md-p">a</p><p class="md-p">b</p>');
  assert.equal(mathText("a\nb"), '<p class="md-p">a<br>b</p>');
});

test("escapes dangerous HTML tags", () => {
  const html = mathText("<script>alert(1)</script>\n<img src=x onerror=alert(1)>");
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
});

test("leaves unclosed math as text while streaming", () => {
  const dollar = mathText("$x");
  assert.ok(dollar.includes("$x"));
  assert.ok(!dollar.includes('class="katex"'));

  const bracket = mathText("\\[x");
  assert.ok(bracket.includes("\\[x"));
  assert.ok(!bracket.includes('class="katex"'));
});
