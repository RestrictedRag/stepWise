"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "../../shell/TopBar";
import LoadingCard from "./LoadingCard";
import { getEntry, type Entry } from "../../../lib/history";
import type { BoardScript } from "../../../lib/board";

const btn = { border: "1px solid var(--line)", background: "var(--bg)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "var(--text)" } as const;

export type LessonState = { script: BoardScript | null; step: number; playing: boolean; asks: { at: number; text: string }[] };

export default function Lesson({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [lesson, setLesson] = useState<LessonState>({ script: null, step: 0, playing: false, asks: [] });
  const [fail, setFail] = useState<string | null>(null);
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

  // placeholder: board, source panel and bottom bar arrive in Tasks 9–11
  return (
    <>
      {bar}
      <main style={{ padding: 24 }} data-lesson>
        <h2 style={{ fontSize: 18 }}>{entry.prompt}</h2>
        <p style={{ color: "var(--muted)" }}>{lesson.script.steps.length} steps</p>
      </main>
    </>
  );
}
