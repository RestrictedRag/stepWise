"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "../../shell/TopBar";
import LoadingCard from "./LoadingCard";
import LiveBoard from "./LiveBoard";
import SourcePanel from "./SourcePanel";
import BottomBar from "./BottomBar";
import EndModal from "./EndModal";
import { getEntry, type Entry } from "../../../lib/history";
import { nextSpeed, speedLabel } from "../../../lib/playback";
import { boardScriptToManifest, type LessonManifest } from "../../../lib/manifest";
import type { BoardScript } from "../../../lib/board";
import { useLessonPlayer } from "./useLessonPlayer";

const btn = {
  border: "1px solid var(--line)",
  background: "var(--bg)",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
  color: "var(--text)",
} as const;

export default function Lesson({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [manifest, setManifest] = useState<LessonManifest | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [volume, setVolume] = useState(1);
  const [busy, setBusy] = useState(false);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const run = useRef(0);

  // Lesson player hook managing audio queue, prefetching, and progressive reveal
  const {
    blocks,
    revealed,
    stepElapsedMs,
    playing,
    toggle,
    speed,
    setSpeed,
    appendColumn,
  } = useLessonPlayer(manifest);

  async function load(e: Entry) {
    const me = ++run.current;
    setFail(null);

    const cached = typeof window !== "undefined" ? sessionStorage.getItem(`solvely.lesson.${e.id}`) : null;
    if (cached) {
      try {
        const m = JSON.parse(cached);
        if (m && m.steps) {
          setManifest(m);
          return;
        }
      } catch {}
    }

    setManifest(null);

    try {
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: e.prompt }),
      });
      const j = await res.json().catch(() => ({}));
      if (me !== run.current) return;
      if (!res.ok || (!j.script && !j.manifest)) {
        setFail(j.error || "Something went wrong.");
      } else {
        const m: LessonManifest = j.manifest || boardScriptToManifest(j.script as BoardScript);
        try {
          sessionStorage.setItem(`solvely.lesson.${e.id}`, JSON.stringify(m));
        } catch {}
        setManifest(m);
      }
    } catch {
      if (me === run.current) setFail("Network error.");
    }
  }

  useEffect(() => {
    const e = getEntry(id);
    setEntry(e);
    if (e) load(e);
    return () => {
      run.current++;
    };
  }, [id]);

  async function ask(text: string) {
    if (!manifest || !entry) return;
    setBusy(true);
    setAskErr(null);

    try {
      const activeBlock = blocks[blocks.length - 1];
      const doubt = {
        question: text,
        say: activeBlock?.transcript || "",
        titles: blocks.slice(-8).map((b) => b.transcript.slice(0, 80)),
      };
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: entry.prompt, doubt }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || (!j.script && !j.manifest)) {
        setAskErr(j.error || "Couldn't answer that.");
      } else {
        const addManifest: LessonManifest = j.manifest || boardScriptToManifest(j.script as BoardScript);
        // Append as a new column to the right, camera auto-follows there
        appendColumn(addManifest);
        setFollow(true);
      }
    } catch {
      setAskErr("Network error.");
    }
    setBusy(false);
  }

  function download() {
    const board = document.querySelector("[data-board]");
    if (!board) return;
    const blob = new Blob([board.outerHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (manifest?.title || "lesson") + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const newQ = (
    <button style={btn} onClick={() => router.push("/")}>
      New question
    </button>
  );

  const bar = (
    <TopBar
      right={
        manifest ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={btn}
              onClick={() => {
                setSpeed(nextSpeed(speed));
              }}
            >
              {speedLabel(speed)}
            </button>
            <button style={btn} onClick={download}>
              Download
            </button>
            <button
              style={{ ...btn, background: "var(--text)", color: "var(--bg)", border: "none" }}
              onClick={() => setEnding(true)}
            >
              End lesson
            </button>
            {newQ}
          </div>
        ) : (
          newQ
        )
      }
    />
  );

  if (entry === undefined) return bar;
  if (entry === null)
    return (
      <>
        {bar}
        <main style={{ padding: 40, textAlign: "center" }}>
          <p>This lesson isn&apos;t available</p>
          <Link href="/" style={{ color: "var(--blue)" }}>
            Home
          </Link>
        </main>
      </>
    );
  if (fail)
    return (
      <>
        {bar}
        <main style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#c0392b" }}>
            {fail}{" "}
            <button style={btn} onClick={() => load(entry)}>
              Try again
            </button>
          </p>
        </main>
      </>
    );
  if (!manifest)
    return (
      <>
        {bar}
        <LoadingCard />
      </>
    );

  const activeBlock = blocks[blocks.length - 1];

  return (
    <>
      {bar}
      <main style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }} data-lesson>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <SourcePanel />
          <LiveBoard
            blocks={blocks}
            revealed={revealed}
            stepElapsedMs={stepElapsedMs}
            follow={follow}
            onFollowChange={setFollow}
            onAsk={ask}
          />
        </div>
        <BottomBar
          caption={askErr || activeBlock?.transcript || ""}
          playing={playing}
          onPlayPause={toggle}
          speed={speed}
          onSpeedChange={setSpeed}
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
