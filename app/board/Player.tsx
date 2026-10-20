"use client";
import { useEffect, useState } from "react";
import Board, { stepSeconds } from "./Board";
import type { BoardScript } from "../../lib/board";

// bare: skip the framed stage when a parent (the home hero) already frames the board.
export default function Player({ script, autoplay = false, bare = false }: { script: BoardScript; autoplay?: boolean; bare?: boolean }) {
  const { steps } = script;
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0); // bump to replay the current step
  const [playing, setPlaying] = useState(autoplay);
  const last = steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (i >= last) { setPlaying(false); return; }
    // shortcut: fixed reading pace for the caption, replace with TTS end events in Phase 2.
    const ms = (stepSeconds(steps[i]) + 0.5 + steps[i].say.length * 0.012) * 1000;
    const id = setTimeout(() => setI(i + 1), ms);
    return () => clearTimeout(id);
  }, [playing, i, last, steps]);

  const go = (n: number) => { setPlaying(false); setI(n); setRun((r) => r + 1); };
  const board = <Board steps={steps} current={i} run={run} title={script.title} />;

  return (
    <div className="player">
      {bare ? board : <div className="board-stage">{board}</div>}
      <div className="progress" aria-hidden="true"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
      <p className="caption" aria-live="polite">{steps[i].say}</p>
      <div className="row">
        <span className="muted step-count">Step {i + 1} of {steps.length}</span>
        <button className="btn ghost" onClick={() => go(i - 1)} disabled={i === 0}>Back</button>
        <button className="btn ghost" onClick={() => go(0)}>Replay</button>
        <button className="btn ghost" onClick={() => setPlaying((p) => !p)} disabled={i === last && !playing}>{playing ? "Pause" : "Play"}</button>
        <button className="btn" onClick={() => go(i + 1)} disabled={i === last}>Next</button>
      </div>
    </div>
  );
}
