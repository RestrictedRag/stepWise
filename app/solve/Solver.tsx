"use client";
import Link from "next/link";
import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { useMic } from "../useMic";
import { mathText } from "../../lib/mathtext";
import "katex/dist/katex.min.css";

const GO = ["Explain it more simply", "Give me a similar problem", "Why does this method work?"];
const EXAMPLES = ["Solve 3x + 5 = 17", "Why is the sky blue?", "A train travels 120 km in 1.5 h. What is its speed?"];

export default function Solver() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const asked = useRef(""); // the question the shown answer is for, so "Go further" chips build on it
  // the transcript lands in the box, the user still presses Solve
  const { mic, micError, toggleMic } = useMic((t) => setText((x) => (x.trim() ? x.trimEnd() + " " : "") + t));

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
    asked.current = text;
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
    <form className={answer ? "solver has-answer" : "solver"} onSubmit={solve}>
      {answer && (
        <div className="answer-bar">
          <button type="button" className="pill-btn" onClick={reset}>+ New question</button>
          <Link className="pill-btn" href="/solve">History</Link>
        </div>
      )}
      <div className="panel">
        <label htmlFor="q" className="sr-only">Your question</label>
        <textarea
          id="q"
          rows={answer ? 2 : 5}
          placeholder="Type a question, or paste a screenshot of it"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
        />
        {image && <img className="preview" src={image} alt="Attached question" />}
        {micError && <p role="alert">{micError}</p>}
        <div className="row">
          <div className="toolbar-start">
            <label className="pill-btn">
              Upload file
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            <button type="button" className="pill-btn" aria-pressed={mic === "rec"} disabled={mic === "busy"} onClick={toggleMic}>
              {mic === "rec" ? "Stop" : mic === "busy" ? "Listening…" : "Speak"}
            </button>
            {!answer && <button type="button" className="pill-btn" onClick={reset}>New question</button>}
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
      {answer && (
        <div className="answer-wrap">
          <Link className="tutor-card" href="/board">
            <span><strong>Tutor Me on the Whiteboard</strong><span className="muted">Watch this solved step by step, out loud.</span></span>
            <span className="start-pill">Start lesson</span>
          </Link>
          <div className="answer steps" aria-live="polite">
            {answer.split(/\n\s*\n/).filter((b) => b.trim()).map((b, n) => {
              const final = /^\s*\**Answer:/i.test(b);
              return (
                <p key={n} className={final ? "block final" : "block"}>
                  {final ? <>Answer: <mark dangerouslySetInnerHTML={{ __html: mathText(b.replace(/^\s*\**Answer:\**\s*/i, "")) }} /></> : <span dangerouslySetInnerHTML={{ __html: mathText(b) }} />}
                </p>
              );
            })}
          </div>
          {!busy && (
            <div className="go-further">
              <p className="tag">Go further</p>
              <div className="chips">
                {GO.map((g) => <button type="button" key={g} className="chip" onClick={() => setText(`${g}: ${asked.current}`)}>{g}</button>)}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
