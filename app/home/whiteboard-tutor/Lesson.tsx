"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "../../shell/TopBar";
import LoadingCard from "./LoadingCard";
import LayeredBoardSurface from "./LayeredBoardSurface";
import SourcePanel from "./SourcePanel";
import BottomBar from "./BottomBar";
import EndModal from "./EndModal";
import { getEntry, type Entry } from "../../../lib/history";
import { loadClips } from "../../../lib/clips";
import { nextSpeed, speedLabel } from "../../../lib/playback";
import { boardScriptToManifest, type LessonManifest } from "../../../lib/manifest";
import { GlobalPlaybackEngine, type GlobalEngineState } from "../../../lib/engine/playbackEngine";
import type { BoardScript } from "../../../lib/board";

const btn = {
  border: "1px solid var(--line)",
  background: "var(--bg)",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
  color: "var(--text)",
} as const;

const speak = (t: string) =>
  fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) })
    .then((r) => (r.ok ? r.blob() : null))
    .catch(() => null);

export default function Lesson({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [manifest, setManifest] = useState<LessonManifest | null>(null);
  const [engineState, setEngineState] = useState<GlobalEngineState | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [busy, setBusy] = useState(false);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [asks, setAsks] = useState<{ at: number; text: string }[]>([]);

  const run = useRef(0);
  const clips = useRef<Promise<Blob | null>[]>([]);
  const blobUrls = useRef<string[]>([]);
  const engineRef = useRef<GlobalPlaybackEngine | null>(null);
  const speedRef = useRef(speed);
  const volRef = useRef(volume);

  async function load(e: Entry) {
    const me = ++run.current;
    setFail(null);
    setManifest(null);
    setEngineState(null);
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }

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
        setManifest(m);

        const engine = new GlobalPlaybackEngine(m.steps);
        engineRef.current = engine;
        engine.setSpeed(speedRef.current);

        engine.subscribe((st) => {
          setEngineState(st);
        });

        // Load clips or bind pre-synthesized audio
        const blobPromises = loadClips(
          m.steps.map((s) => s.speech.transcript),
          speak
        );
        clips.current = blobPromises;

        m.steps.forEach((st, idx) => {
          if (st.speech.audioUrl) {
            const a = new Audio(st.speech.audioUrl);
            a.volume = volRef.current;
            engine.bindStepAudio(idx, a);
          } else {
            blobPromises[idx]?.then((blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              blobUrls.current.push(url);
              const a = new Audio(url);
              a.volume = volRef.current;
              engine.bindStepAudio(idx, a);
            });
          }
        });

        engine.play();
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
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
      blobUrls.current = [];
    };
  }, [id]);

  useEffect(() => {
    speedRef.current = speed;
    volRef.current = volume;
    engineRef.current?.setSpeed(speed);
  }, [speed, volume]);

  async function ask(text: string) {
    if (!manifest || !entry) return;
    const at = engineState?.currentStepIndex ?? 0;
    setAsks((prev) => [...prev, { at, text }]);
    engineRef.current?.pause();
    setBusy(true);
    setAskErr(null);

    try {
      const curStep = manifest.steps[at];
      const doubt = {
        question: text,
        say: curStep.speech.transcript,
        titles: manifest.steps.slice(-8).map((s) => s.speech.transcript.slice(0, 80)),
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
        const addSteps = addManifest.steps;

        addSteps.forEach((s) => engineRef.current?.appendStep(s));

        const addClips = loadClips(
          addSteps.map((s) => s.speech.transcript),
          speak
        );
        addSteps.forEach((st, k) => {
          const targetStepIdx = manifest.steps.length + k;
          if (st.speech.audioUrl) {
            const a = new Audio(st.speech.audioUrl);
            a.volume = volRef.current;
            engineRef.current?.bindStepAudio(targetStepIdx, a);
          } else {
            addClips[k]?.then((b) => {
              if (!b) return;
              const url = URL.createObjectURL(b);
              blobUrls.current.push(url);
              const a = new Audio(url);
              a.volume = volRef.current;
              engineRef.current?.bindStepAudio(targetStepIdx, a);
            });
          }
        });

        setManifest((prev) => (prev ? { ...prev, steps: [...prev.steps, ...addSteps] } : addManifest));
        engineRef.current?.play();
      }
    } catch {
      setAskErr("Network error.");
    }
    setBusy(false);
  }

  function download() {
    const svg = document.querySelector("[data-board] svg");
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = (manifest?.title || "lesson") + ".svg";
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
                const nextSpd = nextSpeed(speed);
                setSpeed(nextSpd);
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

  const currentStepIndex = engineState?.currentStepIndex ?? 0;
  const currentStep = manifest.steps[currentStepIndex];

  return (
    <>
      {bar}
      <main style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }} data-lesson>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <SourcePanel />
          <LayeredBoardSurface
            manifest={manifest}
            step={currentStepIndex}
            engine={engineRef.current}
            follow={follow}
            onFollowChange={setFollow}
            asks={asks}
          />
        </div>
        <BottomBar
          caption={askErr || currentStep?.speech.transcript || ""}
          playing={Boolean(engineState?.isPlaying)}
          onPlayPause={() => {
            if (engineRef.current) {
              if (engineState?.isPlaying) engineRef.current.pause();
              else engineRef.current.play();
            }
          }}
          volume={volume}
          onVolume={setVolume}
          onAsk={ask}
          busy={busy}
          progress={
            engineState && engineState.totalDurationMs > 0
              ? engineState.globalTimeMs / engineState.totalDurationMs
              : 0
          }
          durationMs={engineState?.totalDurationMs ?? 0}
          timeMs={engineState?.globalTimeMs ?? 0}
          onScrubStart={() => engineRef.current?.startScrub()}
          onScrub={(prog) => {
            if (engineRef.current && engineState) {
              engineRef.current.scrubToGlobalMs(prog * engineState.totalDurationMs);
            }
          }}
          onScrubEnd={() => engineRef.current?.endScrub(true)}
        />
      </main>
      <EndModal open={ending} onSubmit={() => router.push("/")} onClose={() => setEnding(false)} />
    </>
  );
}
