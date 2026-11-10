"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "../shell/TopBar";
import { getEntry, newEntry, saveEntry, type Entry, type Mode } from "../../lib/history";
import { hrefFor } from "../../lib/modes";
import { mathText } from "../../lib/mathtext";
import { incomplete, parseAnswer, type Parsed } from "../../lib/answer";
import Flashcards from "./Flashcards";

const STATUS = ["Reading your question…", "Solving step by step…"];
const btn = { border: "1px solid var(--line)", background: "var(--bg)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "var(--text)" } as const;
const shimmer = { height: 14, borderRadius: 6, background: "linear-gradient(90deg, var(--line) 25%, var(--side) 50%, var(--line) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" } as const;

export default function Chat({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [status, setStatus] = useState(0);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [cards, setCards] = useState(false);
  const run = useRef(0);

  async function solve(e: Entry) {
    const me = ++run.current;
    setParsed(null);
    setFail(null);
    try {
      const res = await fetch("/api/solve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: e.prompt, image: e.image }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (me === run.current) setFail(j.error || "Something went wrong.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (me !== run.current) return;
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setParsed(parseAnswer(acc));
      }
      const p = parseAnswer(acc);
      setParsed(p);
      if (incomplete(p)) setFail("No answer came back.");
    } catch {
      if (me === run.current) setFail("Network error.");
    }
  }

  useEffect(() => {
    const e = getEntry(id);
    setEntry(e);
    if (e) solve(e);
    return () => { run.current++; };
  }, [id]);

  const waiting = !!entry && !parsed && !fail;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setStatus((s) => (s + 1) % STATUS.length), 1500);
    return () => clearInterval(t);
  }, [waiting]);

  function go(mode: Mode, prompt: string) {
    const e = newEntry(mode, prompt);
    if (!saveEntry(e)) { setFail("Couldn't save — storage is full or blocked."); return; }
    router.push(hrefFor(e));
  }

  const bar = (
    <TopBar
      right={
        <>
          <button style={btn}>Review later</button>
          <button style={btn}>History</button>
          <button style={btn} onClick={() => router.push("/")}>New question</button>
        </>
      }
    />
  );

  if (entry === undefined) return bar;
  if (entry === null)
    return (
      <>
        {bar}
        <main style={{ padding: 40, textAlign: "center" }}>
          <p>This chat isn&apos;t available</p>
          <Link href="/" style={{ color: "var(--blue)" }}>Home</Link>
        </main>
      </>
    );

  const error = !!fail || !!parsed?.error;
  const done = !!parsed && parsed.answer !== null && !error;

  return (
    <>
      {bar}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px", fontSize: 16, lineHeight: 1.65, color: "#1f2328" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <div style={{ background: "var(--side)", borderRadius: 18, padding: "10px 16px", maxWidth: "70%", overflowWrap: "break-word" }}>
            {entry.image && <img src={`data:${entry.image.mediaType};base64,${entry.image.data}`} alt="Your upload" style={{ maxWidth: 160, borderRadius: 8, display: "block", marginBottom: 6 }} />}
            {entry.prompt}
          </div>
        </div>

        {waiting && (
          <div aria-live="polite">
            <p style={{ color: "var(--muted)" }}>{STATUS[status]}</p>
            {[90, 75, 60].map((w) => <div key={w} style={{ ...shimmer, width: `${w}%`, marginBottom: 10 }} />)}
          </div>
        )}

        {parsed && (
          <>
            <div className="chat-cards">
              {[["Video Explanation", "Watch Now"], ["Tutor Me", "Start"]].map(([t, b]) => (
                <div key={t} className="chat-card">
                  <strong style={{ fontSize: 15, fontWeight: 600 }}>{t}</strong>
                  <button style={{ ...btn, fontSize: 14, flexShrink: 0, whiteSpace: "nowrap" }} onClick={() => go("whiteboard", entry.prompt)}>{b}</button>
                </div>
              ))}
            </div>
            <h2 style={{ color: "var(--blue)", fontSize: 18, fontWeight: 600, margin: "24px 0 12px" }}>Explanation</h2>
            {parsed.summary && (
              <div
                className="md"
                style={{ marginBottom: parsed.steps.length ? 20 : 0 }}
                dangerouslySetInnerHTML={{ __html: mathText(parsed.summary) }}
              />
            )}
            {parsed.steps.length > 0 && (
              <div className="chat-steps">
                {parsed.steps.map((s, i) => {
                  const title =
                    s.title.replace(/^\s*(\*\*\s*)?Step\s+\d+\s*(?:[:.\-–—]\s*|\s+)/i, (_, b) => b ?? "").trim() ||
                    s.title;
                  return (
                    <div key={i} className="chat-step">
                      <span className="chat-step-num">{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="md chat-step-title" dangerouslySetInnerHTML={{ __html: mathText(title) }} />
                        {s.body && (
                          <div
                            className="md"
                            style={{ marginTop: 4 }}
                            dangerouslySetInnerHTML={{ __html: mathText(s.body) }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {done && (
              <div style={{ background: "var(--side)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 16px", margin: "20px 0 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.02em", marginBottom: 4 }}>Answer</div>
                <div className="md" dangerouslySetInnerHTML={{ __html: mathText(parsed.answer!) }} />
              </div>
            )}
          </>
        )}

        {entry.mode === "flashcards" && <Flashcards topic={entry.prompt} />}

        {error && (
          <p style={{ color: "#c0392b" }}>
            {fail || "Couldn't finish solving."}{" "}
            <button style={btn} onClick={() => solve(entry)}>Try again</button>
          </p>
        )}

        {done && (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "16px 0" }}>
              <span style={{ color: "var(--muted)" }}>Helpful?</span>
              <button style={{ ...btn, borderColor: vote === "up" ? "var(--blue)" : "var(--line)" }} aria-pressed={vote === "up"} onClick={() => setVote("up")}>👍</button>
              <button style={{ ...btn, borderColor: vote === "down" ? "var(--blue)" : "var(--line)" }} aria-pressed={vote === "down"} onClick={() => setVote("down")}>👎</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "var(--muted)" }}>Go further</span>
              <button style={btn} onClick={() => setCards(true)}>Flashcards</button>
              <button style={btn} onClick={() => go("solver", "Quiz me on: " + entry.prompt)}>Quiz me</button>
              <button style={btn} onClick={() => go("solver", "Explain simpler: " + entry.prompt)}>Explain simpler</button>
            </div>
            {cards && entry.mode !== "flashcards" && <Flashcards topic={entry.prompt} />}
          </>
        )}
      </main>
    </>
  );
}
