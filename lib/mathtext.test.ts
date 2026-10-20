import test from "node:test";
import assert from "node:assert/strict";
import { mathText } from "./mathtext.ts";

test("renders math and bold, escapes plain text", () => {
  const html = mathText("**Step 1: find \\(n\\)**\n\\[\n\\int x^2\\,dx\n\\]\n<b>x</b>");
  assert.match(html, /^<strong>Step 1: find <span class="katex">/);
  assert.match(html, /katex-display/);
  assert.match(html, /&#60;b&#62;x&#60;\/b&#62;$/);
});

test("leaves unclosed math as text while streaming", () => {
  assert.equal(mathText("so \\[ \\int"), "so \\[ \\int");
});
