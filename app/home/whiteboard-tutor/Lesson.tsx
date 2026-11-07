"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "../../shell/TopBar";
import LoadingCard from "./LoadingCard";
import BoardSurface from "./BoardSurface";
import SourcePanel from "./SourcePanel";
import BottomBar from "./BottomBar";
import EndModal from "./EndModal";
import { getEntry, type Entry } from "../../../lib/history";
import { loadClips } from "../../../lib/clips";
import { nextSpeed, spliceSteps, fallbackMs, speedLabel } from "../../../lib/playback";
import type { BoardScript } from "../../../lib/board";

const btn = { border: "1px solid var(--line)", background: "var(--bg)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "var(--text)" } as const;

const speak = (t: string) =>
  fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) })
    .then((r) => (r.ok ? r.blob() : null))
    .catch(() => null);

export type LessonState = { script: BoardScript | null; step: number; playing: boolean; asks: { at: number; text: string }[] };

export default function Lesson({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [lesson, setLesson] = useState<LessonState>({ script: null, step: 0, playing: false, asks: [] });
  const [fail, setFail] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [clipSeconds, setClipSeconds] = useState(2);
  const [busy, setBusy] = useState(false);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const run = useRef(0);
  const clips = useRef<Promise<Blob | null>[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const resume = useRef({ step: -1, t: 0 });
  const speedRef = useRef(speed);
  const volRef = useRef(volume);

  async function load(e: Entry) {
    const me = ++run.current;
    setFail(null);
    setLesson({ script: null, step: 0, playing: false, asks: [] });
    try {
      const res = await fetch("/api/lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: e.prompt }) });
      const j = await res.json().catch(() => ({}));
      if (me !== run.current) return;
      if (!res.ok || !j.script) setFail(j.error || "Something went wrong.");
      else {
        clips.current = loadClips((j.script as BoardScript).steps.map((s) => s.say), speak);
        setLesson({ script: j.script, step: 0, playing: true, asks: [] });
      }
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

  const { script, step, playing } = lesson;

  useEffect(() => {
    if (!playing || !script) return;
    const at = step, say = script.steps[at].say;
    let dead = false, url = "", timer: ReturnType<typeof setTimeout> | undefined, a: HTMLAudioElement | null = null;
    const advance = () => { if (!dead) setLesson((l) => (at + 1 < l.script!.steps.length ? { ...l, step: at + 1 } : { ...l, playing: false })); };
    const fallback = () => { timer = setTimeout(advance, fallbackMs(say, speedRef.current)); };
    setClipSeconds(fallbackMs(say, speedRef.current) / 1000);
    (clips.current[at] ?? Promise.resolve(null)).then((b) => {
      if (dead) return;
      if (!b) return fallback();
      url = URL.createObjectURL(b);
      a = audio.current = new Audio(url);
      a.playbackRate = speedRef.current;
      a.volume = volRef.current;
      a.onloadedmetadata = () => {
        // pause tears the effect down, so resume picks up where the clip stopped
        if (resume.current.step === at) a!.currentTime = resume.current.t;
        setClipSeconds(a!.duration / speedRef.current);
      };
      a.onended = advance;
      a.play().catch(fallback);
    });
    return () => {
      dead = true;
      clearTimeout(timer);
      if (a) { resume.current = { step: at, t: a.currentTime }; a.pause(); }
      if (url) URL.revokeObjectURL(url);
      audio.current = null;
    };
  }, [playing, step, script]);

  useEffect(() => {
    speedRef.current = speed;
    volRef.current = volume;
    if (audio.current) { audio.current.playbackRate = speed; audio.current.volume = volume; }
  }, [speed, volume]);

  async function ask(text: string) {
    if (!script || !entry) return;
    const at = step;
    setLesson((l) => ({ ...l, playing: false, asks: [...l.asks, { at, text }] }));
    setBusy(true);
    setAskErr(null);
    try {
      const doubt = { question: text, say: script.steps[at].say, titles: script.steps.slice(-8).map((s) => s.say.slice(0, 80)) };
      const res = await fetch("/api/lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: entry.prompt, doubt }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.script) setAskErr(j.error || "Couldn't answer that.");
      else {
        const add = (j.script as BoardScript).steps;
        clips.current = spliceSteps(clips.current, at, loadClips(add.map((s) => s.say), speak));
        setLesson((l) => ({ ...l, script: { ...l.script!, steps: spliceSteps(l.script!.steps, at, add) }, step: at + 1, playing: true }));
      }
    } catch {
      setAskErr("Network error.");
    }
    setBusy(false);
  }

  function download() {
    const svg = document.querySelector("[data-board] svg");
    if (!svg) return;
    // shortcut: CSS vars and the board font don't travel with the file, so colors fall back; inline them if users complain
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = (script?.title || "lesson") + ".svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const newQ = <button style={btn} onClick={() => router.push("/")}>New question</button>;
  const bar = (
    <TopBar
      right={script ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={() => setSpeed(nextSpeed)}>{speedLabel(speed)}</button>
          <button style={btn} onClick={download}>Download</button>
          <button style={{ ...btn, background: "var(--text)", color: "var(--bg)", border: "none" }} onClick={() => setEnding(true)}>End lesson</button>
          {newQ}
        </div>
      ) : newQ}
    />
  );

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
          <p style={{ color: "#c0392b" }}>{fail} <button style={btn} onClick={() => load(entry)}>Try again</button></p>
        </main>
      </>
    );
  if (!script) return <>{bar}<LoadingCard /></>;

  return (
    <>
      {bar}
      <main style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }} data-lesson>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <SourcePanel />
          <BoardSurface script={script} step={step} clipSeconds={clipSeconds} follow={follow} onFollowChange={setFollow} asks={lesson.asks} />
        </div>
        <BottomBar
          caption={askErr || script.steps[step].say}
          playing={playing}
          onPlayPause={() => setLesson((l) => ({ ...l, playing: !l.playing }))}
          volume={volume}
          onVolume={setVolume}
          onAsk={ask}
          busy={busy}
        />
      </main>
      <EndModal open={ending} onSubmit={() => router.push("/")} onClose={() => setEnding(false)} />
    </>
  );
}
