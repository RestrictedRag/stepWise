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
  const [voice, setVoice] = useState(false); // off by default: browsers block sound before a click
  const [heard, setHeard] = useState(-1); // step whose narration finished (or failed)
  const last = steps.length - 1;

  // Read the current step aloud with Vachana; any failure just marks it heard so play never stalls.
  useEffect(() => {
    if (!voice) return;
    setHeard(-1);
    const a = new Audio();
    let url = "";
    let gone = false;
    const done = () => { if (!gone) setHeard(i); };
    a.onended = done;
    fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: steps[i].say }) })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => { if (gone) return; url = URL.createObjectURL(b); a.src = url; return a.play(); })
      .catch(done);
    return () => { gone = true; a.pause(); if (url) URL.revokeObjectURL(url); };
  }, [voice, i, run, steps]);

  useEffect(() => {
    if (!playing) return;
    if (i >= last) { setPlaying(false); return; }
    if (voice && heard !== i) return; // wait for the narration to end
    // muted: fixed reading pace for the caption
    const ms = voice ? 400 : (stepSeconds(steps[i], i === 0) + 0.5 + steps[i].say.length * 0.012) * 1000;
    const id = setTimeout(() => setI(i + 1), ms);
    return () => clearTimeout(id);
  }, [playing, i, last, steps, voice, heard]);

  const go = (n: number) => { setPlaying(false); setI(n); setRun((r) => r + 1); };
  const board = <Board steps={steps} current={i} run={run} title={script.title} subtitle={script.subtitle} />;

  return (
    <div className="player">
      {bare ? board : <div className="board-stage">{board}</div>}
      <div className="progress" aria-hidden="true"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
      <p className="caption" aria-live="polite">{steps[i].say}</p>
      <div className="row">
        <span className="muted step-count">Step {i + 1} of {steps.length}</span>
        <button className="btn ghost" onClick={() => go(i - 1)} disabled={i === 0}>Back</button>
        <button className="btn ghost" onClick={() => go(0)}>Replay</button>
        <button className="btn ghost" onClick={() => setVoice((v) => !v)} aria-pressed={voice}>{voice ? "Mute" : "Voice"}</button>
        <button className="btn ghost" onClick={() => setPlaying((p) => !p)} disabled={i === last && !playing}>{playing ? "Pause" : "Play"}</button>
        <button className="btn" onClick={() => go(i + 1)} disabled={i === last}>Next</button>
      </div>
    </div>
  );
}
