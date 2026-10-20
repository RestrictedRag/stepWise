"use client";
import { useState, type FormEvent } from "react";
import Player from "./Player";
import { PERSONAS, LEVELS } from "../../lib/validate";
import type { BoardScript } from "../../lib/board";

export default function Teach() {
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState<string>("teacher");
  const [level, setLevel] = useState<string>("middle");
  const [lesson, setLesson] = useState<{ script: BoardScript; fallback: boolean; id: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function teach(e: FormEvent) {
    e.preventDefault();
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
      setLesson({ ...data, id: Date.now() });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Teach me">
      <form className="solver" onSubmit={teach}>
        <div className="panel">
          <label htmlFor="topic" className="sr-only">Topic</label>
          <input id="topic" placeholder="What do you want to learn?" maxLength={300} value={topic} onChange={(e) => setTopic(e.target.value)} />
          <div className="row">
            <div className="toolbar-start">
              <label>Style <select value={persona} onChange={(e) => setPersona(e.target.value)}>{PERSONAS.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label>Level <select value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
            </div>
            <button type="submit" className="btn" disabled={busy || !topic.trim()}>{busy ? "Drawing…" : "Teach me"}</button>
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
      </form>
      {lesson && (
        <>
          <div className="lesson-head">
            <h2>{lesson.script.title}</h2>
            {lesson.fallback && <p className="muted">The tutor is offline, so here is a saved lesson.</p>}
          </div>
          <Player key={lesson.id} script={lesson.script} />
        </>
      )}
    </section>
  );
}
