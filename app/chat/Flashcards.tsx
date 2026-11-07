"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "../../lib/flashcards";

const btn = { border: "1px solid var(--line)", background: "var(--bg)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "var(--text)" } as const;
const face = { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg)", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontSize: 18 } as const;

export default function Flashcards({ topic }: { topic: string }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [fail, setFail] = useState(false);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [tally, setTally] = useState({ review: 0, mastered: 0 });
  const run = useRef(0);

  async function load() {
    const me = ++run.current;
    setCards(null);
    setFail(false);
    restart();
    try {
      const res = await fetch("/api/flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
      const j = await res.json().catch(() => ({}));
      if (me !== run.current) return;
      if (!res.ok || !Array.isArray(j.cards) || !j.cards.length) setFail(true);
      else setCards(j.cards);
    } catch {
      if (me === run.current) setFail(true);
    }
  }

  function restart() {
    setI(0);
    setFlip(false);
    setTally({ review: 0, mastered: 0 });
  }

  function mark(k: "review" | "mastered") {
    setTally((t) => ({ ...t, [k]: t[k] + 1 }));
    setFlip(false);
    setI((n) => n + 1);
  }

  useEffect(() => {
    load();
    return () => { run.current++; };
  }, [topic]);

  if (fail)
    return (
      <p style={{ color: "#c0392b", margin: "16px 0" }}>
        Couldn&apos;t make flashcards <button style={btn} onClick={load}>Retry</button>
      </p>
    );
  if (!cards) return <p style={{ color: "var(--muted)", margin: "16px 0" }} aria-live="polite">Making flashcards…</p>;

  if (i >= cards.length)
    return (
      <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 24, margin: "16px 0", textAlign: "center" }}>
        <p>Mastered: {tally.mastered} · Need to review: {tally.review}</p>
        <button style={btn} onClick={restart}>Restart</button>
      </div>
    );

  const c = cards[i];
  return (
    <div style={{ margin: "16px 0" }}>
      <p style={{ color: "var(--muted)", textAlign: "center" }}>{i + 1} / {cards.length}</p>
      <button type="button" style={{ display: "block", width: "100%", border: "none", background: "none", padding: 0, font: "inherit", color: "inherit", perspective: 1000, height: 240, cursor: "pointer" }} onClick={() => setFlip((f) => !f)} aria-label={flip ? "Show question" : "Show answer"}>
        <div style={{ position: "relative", height: "100%", transition: "transform 0.5s", transformStyle: "preserve-3d", transform: flip ? "rotateY(180deg)" : "none" }}>
          <div style={face}>{c.q}</div>
          <div style={{ ...face, transform: "rotateY(180deg)", background: "#eaf2ff", color: "#0b2a5b" }}>{c.a}</div>
        </div>
      </button>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
        <button style={btn} onClick={() => mark("review")}>Need to review</button>
        <button style={btn} onClick={() => mark("mastered")}>Mastered</button>
      </div>
    </div>
  );
}
