"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Player from "./Player";
import { useMic } from "../useMic";
import { PERSONAS, LEVELS } from "../../lib/validate";
import type { BoardScript } from "../../lib/board";

type Props = { demo: BoardScript; demoKey: string; demos: string[] };

// Full-screen lesson room: course source on the left, the whiteboard with its controls on the right.
export default function Teach({ demo, demoKey, demos }: Props) {
  const [topic, setTopic] = useState("");
  const [asked, setAsked] = useState("");
  const [persona, setPersona] = useState<string>("teacher");
  const [level, setLevel] = useState<string>("middle");
  const [lesson, setLesson] = useState<{ script: BoardScript; fallback: boolean; id: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [srcOpen, setSrcOpen] = useState(true);
  const { mic, micError, toggleMic } = useMic((t) => setTopic((x) => (x.trim() ? x.trimEnd() + " " : "") + t));

  async function teach(e: FormEvent) {
    e.preventDefault();
    if (busy || !topic.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, persona, level }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Something went wrong.");
      setAsked(topic);
      setTopic("");
      setLesson({ ...data, id: Date.now() });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const script = lesson?.script ?? demo;
  const dock = (
    <form className="wb-dock" onSubmit={teach}>
      <button type="button" className="wb-pen" aria-label="Write your question" onClick={() => document.getElementById("topic")?.focus()}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>
      </button>
      <div className="wb-field">
        <label htmlFor="topic" className="sr-only">Your question</label>
        <input id="topic" placeholder="+ Type your question or response" maxLength={300} value={topic} onChange={(e) => setTopic(e.target.value)} />
        <button type="submit" className="wb-send" disabled={busy || !topic.trim()} aria-label={busy ? "Drawing" : "Send"}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
        </button>
      </div>
      <button type="button" className={mic === "rec" ? "wb-mic rec" : "wb-mic"} onClick={toggleMic} disabled={mic === "busy"} aria-pressed={mic === "rec"} aria-label={mic === "rec" ? "Stop recording" : "Ask by voice"}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </button>
      {(micError || error) && <p className="wb-err" role="alert">{micError || error}</p>}
    </form>
  );

  return (
    <div className="wb">
      {srcOpen && (
        <>
          <aside className="wb-src" aria-label="Course source">
            <header className="wb-head">
              <div><p className="wb-kicker">Course source</p><h2>Original materials</h2></div>
              <button type="button" className="wb-x" onClick={() => setSrcOpen(false)} aria-label="Hide source panel">×</button>
            </header>
            <h3>Instructions</h3>
            <p className="wb-q">{lesson ? asked : script.title}</p>
            {lesson?.fallback && <p className="wb-q">The tutor is offline, so here is a saved lesson.</p>}
            <div className="wb-upload">
              <span className="wb-upload-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 18v-6m-3 3 3-3 3 3" /></svg>
              </span>
              <strong>No uploaded file</strong>
              <p>Upload an image, PDF, PowerPoint, Word, or text file to view and use it in the lesson.</p>
              <Link className="wb-upload-btn" href="/pdf">Upload files</Link>
            </div>
            <div className="wb-opts">
              <label>Style <select value={persona} onChange={(e) => setPersona(e.target.value)}>{PERSONAS.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label>Level <select value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
            </div>
            <nav className="wb-demos" aria-label="Sample lessons">
              {demos.map((k) => (
                <Link key={k} href={`/board?demo=${k}`} aria-current={!lesson && k === demoKey ? "page" : undefined}>{k}</Link>
              ))}
            </nav>
          </aside>
          <div className="wb-handle" aria-hidden="true" />
        </>
      )}
      <div className="wb-main">
        {!srcOpen && <button type="button" className="wb-show" onClick={() => setSrcOpen(true)}>Show source</button>}
        <Player wb key={lesson?.id ?? demoKey} script={script} dock={dock} onEnd={lesson ? () => setLesson(null) : undefined} />
      </div>
    </div>
  );
}
