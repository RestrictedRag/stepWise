"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  onEnd?: () => void; dock?: ReactNode; // stage chrome: End lesson handler and the bottom-right composer
  wb?: boolean; // /board's full-screen lesson room chrome
};

const SPEEDS = [1, 1.25, 1.5, 0.75];

// bare: skip the framed stage when a parent (the home hero) already frames the board.
export default function Player({ script, autoplay = false, bare = false, clips, onClips, lang, startStep, onStep, paused, onEnd, dock, wb = false }: Props) {
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
  const [speed, setSpeed] = useState(1);
  const [cc, setCc] = useState(true);
  const speedRef = useRef(speed); speedRef.current = speed;

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
        setDTag({ key: k, d: shapeDelays(steps[i], secs / speedRef.current) });
        if (!pausedRef.current) a.play().catch(() => setPacedKey(k));
      };
      a.defaultPlaybackRate = a.playbackRate = speedRef.current;
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

  useEffect(() => { if (audio.current) audio.current.playbackRate = speed; }, [speed]);

  useEffect(() => {
    if (!playing || isPaused) return;
    if (i >= last) { setPlaying(false); return; }
    if (!textPaced && heard !== i) return; // wait for the narration to end
    const ms = left.current ?? (textPaced ? (stepSeconds(steps[i], i === 0) + 0.5 + steps[i].say.length * 0.012) * 1000 / speed : 400);
    const end = Date.now() + ms;
    const id = setTimeout(() => setI(i + 1), ms);
    return () => { clearTimeout(id); if (pausedRef.current) left.current = Math.max(0, end - Date.now()); };
  }, [playing, isPaused, i, last, steps, textPaced, heard, speed]);

  const go = (n: number) => { setPlaying(false); setI(n); setRun((r) => r + 1); };
  // shortcut: in-flight framer moves (<1s) finish while paused, set duration 0 when paused if visible
  const board = <Board steps={steps} current={i} run={run} title={script.title} subtitle={script.subtitle} delays={delays} hold={voice && !textPaced && !delays} />;

  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(script, null, 2)], { type: "application/json" }));
    a.download = `${script.title || "lesson"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (bare) return (
    <div className={isPaused ? "player paused" : "player"}>
      {board}
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

  // Pause/Resume here drives auto-advance too: resuming a stopped lesson starts it playing.
  const toggle = () => { if (paused !== undefined) return; if (!playing && i < last) { setPausedState(false); setPlaying(true); } else setPausedState((p) => !p); };
  const running = playing && !isPaused;
  const speedLabel = speed % 1 ? speed : speed.toFixed(1);
  const playIcon = running
    ? <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
    : <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>;
  const voiceIcon = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" />{voice ? <path d="M16 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" /> : <path d="m17 9 5 6m0-6-5 6" />}</svg>;

  if (wb) return (
    <div className={isPaused ? "player paused" : "player"}>
      <div className="wb-stage">
        {board}
        <div className="wb-top">
          <div className="wb-pill">
            <button type="button" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} aria-label={`Playback speed ${speed}x, click to change`}>
              <b>{speedLabel}x</b> Speed <span aria-hidden="true">⌄</span>
            </button>
            <span className="wb-sep" aria-hidden="true" />
            <button type="button" onClick={download} aria-label="Download lesson">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" /></svg>
            </button>
          </div>
          <button type="button" className="wb-pill wb-end" onClick={onEnd ?? (() => go(0))}><i aria-hidden="true" /> End lesson</button>
        </div>
        <div className="wb-bottom">
          <div className="wb-ctrls">
            <span className="wb-avatar" title={`Step ${i + 1} of ${steps.length}`}><b>{speed.toFixed(2)}</b><span className="sr-only">Step {i + 1} of {steps.length}</span></span>
            <button type="button" className={cc ? "wb-btn on" : "wb-btn"} onClick={() => setCc((c) => !c)} aria-pressed={cc} aria-label="Captions">CC</button>
            <button type="button" className="wb-btn" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
            </button>
            <button type="button" className="wb-btn" onClick={toggle} disabled={paused !== undefined} aria-label={running ? "Pause" : "Play"}>{playIcon}</button>
            <button type="button" className="wb-btn" onClick={() => go(i + 1)} disabled={i === last} aria-label="Next step">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
            </button>
            <button type="button" className="wb-btn" onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label={voice ? "Mute narration" : "Turn on narration"}>{voiceIcon}</button>
          </div>
          <div className="wb-cap">
            <p className={cc ? "wb-caption" : "wb-caption sr-only"} aria-live="polite">{steps[i].say}</p>
            <div className="progress" aria-hidden="true"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
          </div>
          {dock}
        </div>
      </div>
    </div>
  );

  return (
    <div className={isPaused ? "player paused" : "player"}>
      <div className="board-stage">
        {board}
        <div className="stage-top">
          <button type="button" className="stage-pill" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} aria-label={`Playback speed ${speed}x, click to change`}>
            <b>{speed % 1 ? speed : speed.toFixed(1)}x</b> Speed <span aria-hidden="true">⌄</span>
          </button>
          <button type="button" className="stage-icon" onClick={download} aria-label="Download lesson">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" /></svg>
          </button>
          <button type="button" className="stage-pill end" onClick={onEnd ?? (() => go(0))}><i aria-hidden="true" /> End lesson</button>
        </div>
        <div className="stage-bottom">
          <div className="stage-ctrls">
            <span className="stage-avatar" title={`Step ${i + 1} of ${steps.length}`}>{i + 1}/{steps.length}</span>
            <button type="button" className={cc ? "stage-icon on" : "stage-icon"} onClick={() => setCc((c) => !c)} aria-pressed={cc} aria-label="Captions">CC</button>
            <button type="button" className="stage-icon" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
            </button>
            <button type="button" className="stage-icon" onClick={toggle} disabled={paused !== undefined} aria-label={running ? "Pause" : "Play"}>
              {running
                ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
                : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>}
            </button>
            <button type="button" className="stage-icon" onClick={() => go(i + 1)} disabled={i === last} aria-label="Next step">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
            </button>
            <button type="button" className="stage-icon" onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label={voice ? "Mute narration" : "Turn on narration"}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" />{voice ? <path d="M16 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" /> : <path d="m17 9 5 6m0-6-5 6" />}</svg>
            </button>
          </div>
          <p className={cc ? "stage-caption" : "stage-caption sr-only"} aria-live="polite">{steps[i].say}</p>
          <div className="progress" aria-hidden="true"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        </div>
        {dock && <div className="stage-dock">{dock}</div>}
      </div>
    </div>
  );
}
