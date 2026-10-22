"use client";
import { useEffect, useRef, useState } from "react";
import Board, { stepSeconds } from "./Board";
import type { BoardScript } from "../../lib/board";
import { loadClips } from "../../lib/clips";
import { shapeDelays } from "../../lib/sync";

const speak = (text: string, lang?: string) =>
  fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) }).then((r) => (r.ok ? r.blob() : null));

type Props = {
  script: BoardScript; autoplay?: boolean; bare?: boolean;
  clips?: (Blob | null)[]; onClips?: (clips: (Blob | null)[]) => void;
  lang?: string; startStep?: number; onStep?: (i: number) => void;
  paused?: boolean; // controlled: when defined it overrides the Pause button
};

// bare: skip the framed stage when a parent (the home hero) already frames the board.
export default function Player({ script, autoplay = false, bare = false, clips, onClips, lang, startStep, onStep, paused }: Props) {
  const { steps } = script;
  const last = steps.length - 1;
  const [i, setI] = useState(Math.min(Math.max(startStep ?? 0, 0), last));
  const [run, setRun] = useState(0); // bump to replay the current step
  const [playing, setPlaying] = useState(autoplay);
  const [voice, setVoice] = useState(clips !== undefined || onClips !== undefined); // PDF page speaks by default; /board stays muted: browsers block sound before a click
  const [heard, setHeard] = useState(-1); // step whose narration finished
  // delays and the no-audio flag are tagged with the step/run they belong to, so a new step never renders with the previous step's values
  const key = `${i}-${run}`;
  const [dTag, setDTag] = useState<{ key: string; d: number[] } | null>(null);
  const [pacedKey, setPacedKey] = useState(""); // step whose clip is missing or failed: advance at reading pace
  const delays = dTag?.key === key ? dTag.d : undefined;
  const textPaced = !voice || pacedKey === key;
  const [pausedState, setPausedState] = useState(false);
  const isPaused = paused ?? pausedState;

  const live = useRef({ clips, onClips, onStep, lang }); live.current = { clips, onClips, onStep, lang };
  const pausedRef = useRef(isPaused); pausedRef.current = isPaused;
  const clipPs = useRef<{ steps: typeof steps; ps: Promise<Blob | null>[] } | null>(null); // cached per script so Mute/Voice cycles reuse it
  const lastStep = useRef(-1);
  const audio = useRef<HTMLAudioElement | null>(null); // the step's Audio lives here so pause doesn't tear it down
  const left = useRef<number | null>(null); // ms remaining on the advance timer while paused

  // Fetch all clips (or reuse stored ones) once voice is on.
  useEffect(() => {
    if (!voice || clipPs.current?.steps === steps) return;
    const ps = loadClips(steps.map((s) => s.say), (t) => speak(t, live.current.lang), live.current.clips);
    clipPs.current = { steps, ps };
    Promise.all(ps).then((c) => { if (clipPs.current?.steps === steps) live.current.onClips?.(c); });
  }, [voice, steps]);

  // Start the current step: wait for its clip, then sync the shapes to the clip length and play it.
  useEffect(() => {
    left.current = null;
    setHeard(-1);
    if (lastStep.current !== i) { lastStep.current = i; live.current.onStep?.(i); }
    if (!voice) return;
    let gone = false, url = "";
    const a = new Audio();
    const k = `${i}-${run}`;
    audio.current = a;
    clipPs.current!.ps[i].then((b) => {
      if (gone) return;
      if (!b) { setPacedKey(k); return; }
      url = URL.createObjectURL(b);
      a.onended = () => { if (!gone) setHeard(i); };
      a.onerror = () => { if (!gone) setPacedKey(k); };
      a.onloadedmetadata = () => {
        if (gone) return;
        const secs = isFinite(a.duration) ? a.duration : stepSeconds(steps[i]);
        setDTag({ key: k, d: shapeDelays(steps[i], secs) });
        if (!pausedRef.current) a.play().catch(() => setPacedKey(k));
      };
      a.src = url;
    });
    return () => { gone = true; a.pause(); audio.current = null; if (url) URL.revokeObjectURL(url); };
  }, [voice, i, run, steps]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    if (isPaused) a.pause();
    else if (a.readyState >= 1 && !a.ended) a.play().catch(() => {});
  }, [isPaused]);

  useEffect(() => {
    if (!playing || isPaused) return;
    if (i >= last) { setPlaying(false); return; }
    if (!textPaced && heard !== i) return; // wait for the narration to end
    const ms = left.current ?? (textPaced ? (stepSeconds(steps[i], i === 0) + 0.5 + steps[i].say.length * 0.012) * 1000 : 400);
    const end = Date.now() + ms;
    const id = setTimeout(() => setI(i + 1), ms);
    return () => { clearTimeout(id); if (pausedRef.current) left.current = Math.max(0, end - Date.now()); };
  }, [playing, isPaused, i, last, steps, textPaced, heard]);

  const go = (n: number) => { setPlaying(false); setI(n); setRun((r) => r + 1); };
  // shortcut: in-flight framer moves (<1s) finish while paused, set duration 0 when paused if visible
  const board = <Board steps={steps} current={i} run={run} title={script.title} subtitle={script.subtitle} delays={delays} hold={voice && !textPaced && !delays} />;

  return (
    <div className={isPaused ? "player paused" : "player"}>
      {bare ? board : <div className="board-stage">{board}</div>}
      <div className="progress" aria-hidden="true"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
      <p className="caption" aria-live="polite">{steps[i].say}</p>
      <div className="row">
        <span className="muted step-count">Step {i + 1} of {steps.length}</span>
        <button className="btn ghost" onClick={() => go(i - 1)} disabled={i === 0}>Back</button>
        <button className="btn ghost" onClick={() => go(0)}>Replay</button>
        <button className="btn ghost" onClick={() => setVoice((v) => !v)} aria-pressed={voice}>{voice ? "Mute" : "Voice"}</button>
        <button className="btn ghost" onClick={() => setPausedState((p) => !p)} disabled={paused !== undefined} aria-pressed={isPaused}>{isPaused ? "Resume" : "Pause"}</button>
        <button className="btn ghost" onClick={() => setPlaying((p) => !p)} disabled={i === last && !playing}>{playing ? "Stop" : "Play"}</button>
        <button className="btn" onClick={() => go(i + 1)} disabled={i === last}>Next</button>
      </div>
    </div>
  );
}
