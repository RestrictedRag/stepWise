"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "../../shell/TopBar";
import LoadingCard from "./LoadingCard";
import BoardSurface from "./BoardSurface";
import SourcePanel from "./SourcePanel";
import { getEntry, type Entry } from "../../../lib/history";
import type { BoardScript } from "../../../lib/board";

const btn = { border: "1px solid var(--line)", background: "var(--bg)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "var(--text)" } as const;

export type LessonState = { script: BoardScript | null; step: number; playing: boolean; asks: { at: number; text: string }[] };

export default function Lesson({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [lesson, setLesson] = useState<LessonState>({ script: null, step: 0, playing: false, asks: [] });
  const [fail, setFail] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const run = useRef(0);

  async function load(e: Entry) {
    const me = ++run.current;
    setFail(null);
    setLesson({ script: null, step: 0, playing: false, asks: [] });
    try {
      const res = await fetch("/api/lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: e.prompt }) });
      const j = await res.json().catch(() => ({}));
      if (me !== run.current) return;
      if (!res.ok || !j.script) setFail(j.error || "Something went wrong.");
      else setLesson({ script: j.script, step: 0, playing: true, asks: [] });
    } catch {
      if (me === run.current) setFail("Network error.");
    }
  }

  useEffect(() => {
    const e = getEntry(id);
    setEntry(e);
    if (e) load(e);
    return () => { run.current++; };
  }, [id]);

  const bar = <TopBar right={<button style={btn} onClick={() => router.push("/")}>New question</button>} />;

  if (entry === undefined) return bar;
  if (entry === null)
    return (
      <>
        {bar}
        <main style={{ padding: 40, textAlign: "center" }}>
          <p>This lesson isn&apos;t available</p>
          <Link href="/" style={{ color: "var(--blue)" }}>Home</Link>
        </main>
      </>
    );

  if (fail)
    return (
      <>
        {bar}
        <main style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#c0392b" }}>
            {fail} <button style={btn} onClick={() => load(entry)}>Try again</button>
          </p>
        </main>
      </>
    );

  if (!lesson.script) return <>{bar}<LoadingCard /></>;

  const { script, step } = lesson;
  const go = (n: number) => { setLesson((l) => ({ ...l, step: Math.max(0, Math.min(script.steps.length - 1, n)) })); setFollow(true); };
  // shortcut: clip length estimated from text until Task 11 wires real audio
  const clipSeconds = Math.max(2, script.steps[step].say.length / 15);
  return (
    <>
      {bar}
      <main style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }} data-lesson>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <SourcePanel />
          <BoardSurface script={script} step={step} clipSeconds={clipSeconds} follow={follow} onFollowChange={setFollow} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: 8, borderTop: "1px solid var(--line)" }}>
          <button style={btn} onClick={() => go(step - 1)} disabled={step === 0}>Prev</button>
          <span style={{ alignSelf: "center" }}>{step + 1} / {script.steps.length}</span>
          <button style={btn} onClick={() => go(step + 1)} disabled={step === script.steps.length - 1}>Next</button>
        </div>
      </main>
    </>
  );
}
