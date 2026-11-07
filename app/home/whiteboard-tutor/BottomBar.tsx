"use client";

import { useState } from "react";
import { useMic } from "../../useMic";
import { canSubmit } from "../../../lib/modes";

const btn = { border: "1px solid var(--line)", background: "var(--bg)", borderRadius: 999, padding: "6px 12px", cursor: "pointer", color: "var(--text)" } as const;

type Props = {
  caption: string;
  playing: boolean;
  onPlayPause: () => void;
  volume: number;
  onVolume: (v: number) => void;
  onAsk: (text: string) => void;
  busy: boolean;
};

export default function BottomBar({ caption, playing, onPlayPause, volume, onVolume, onAsk, busy }: Props) {
  const [text, setText] = useState("");
  const { mic, micError, toggleMic } = useMic((t) => setText((p) => (p ? p + " " + t : t)));
  const ok = canSubmit(text, false) && !busy;
  const send = () => { if (!ok) return; onAsk(text.trim()); setText(""); };

  return (
    <div data-bottom-bar style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
      <div aria-hidden style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--blue)", flexShrink: 0 }} />
      <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{caption}</p>
      <button aria-label={playing ? "Pause" : "Play"} style={btn} onClick={onPlayPause}>{playing ? "❚❚" : "▶"}</button>
      <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => onVolume(Number(e.target.value))} style={{ width: 80 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 999, padding: "4px 6px 4px 14px" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={micError || "Type your question or response"} disabled={busy}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 14 }} />
        <button aria-label={mic === "rec" ? "Stop recording" : "Record"} onClick={toggleMic} disabled={mic === "busy"} style={{ ...btn, border: "none", color: mic === "rec" ? "#d33" : "var(--muted)" }}>●</button>
        <button aria-label="Send" onClick={send} disabled={!ok} style={{ ...btn, background: ok ? "var(--text)" : "var(--line)", color: "var(--bg)", border: "none" }}>↑</button>
      </div>
    </div>
  );
}
