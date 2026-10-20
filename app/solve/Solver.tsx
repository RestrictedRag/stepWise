"use client";
import { useState, type ClipboardEvent, type FormEvent } from "react";

const EXAMPLES = ["Solve 3x + 5 = 17", "Why is the sky blue?", "A train travels 120 km in 1.5 h. What is its speed?"];

export default function Solver() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  function pickImage(file?: File) {
    if (!file) return setImage(null);
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onPaste(e: ClipboardEvent) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) pickImage(file);
  }

  async function solve(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAnswer("");
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, image }),
      });
      if (!res.ok) {
        setAnswer((await res.json()).error || "Something went wrong.");
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((a) => a + decoder.decode(value, { stream: true }));
      }
    } catch {
      setAnswer("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setText("");
    setImage(null);
    setAnswer("");
  }

  return (
    <form className="solver" onSubmit={solve}>
      <div className="panel">
        <label htmlFor="q" className="sr-only">Your question</label>
        <textarea
          id="q"
          rows={5}
          placeholder="Type a question, or paste a photo of it"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
        />
        {image && <img className="preview" src={image} alt="Attached question" />}
        <div className="row">
          <div className="toolbar-start">
            <label className="btn ghost">
              Add photo
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            <button type="button" className="btn ghost" onClick={reset}>New question</button>
          </div>
          <button type="submit" className="btn" disabled={busy || (!text.trim() && !image)}>
            {busy ? "Solving…" : <>Solve <span className="arr" aria-hidden="true">→</span></>}
          </button>
        </div>
      </div>
      {!text && !answer && (
        <div className="chips" aria-label="Examples">
          {EXAMPLES.map((ex) => <button type="button" key={ex} className="chip" onClick={() => setText(ex)}>{ex}</button>)}
        </div>
      )}
      {/* shortcut: plain text output, add Markdown + KaTeX rendering when math formatting matters */}
      {answer && (
        <div className="answer" aria-live="polite">
          {answer.split(/\n\s*\n/).filter((b) => b.trim()).map((b, n) => {
            const final = /^\s*\**Answer:/i.test(b);
            return (
              <p key={n} className={final ? "block final" : "block"}>
                {final ? <>Answer: <mark>{b.replace(/^\s*\**Answer:\**\s*/i, "")}</mark></> : b}
              </p>
            );
          })}
        </div>
      )}
    </form>
  );
}
