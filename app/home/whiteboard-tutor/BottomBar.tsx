"use client";

import { useState } from "react";
import { useMic } from "../../useMic";
import { canSubmit } from "../../../lib/modes";
import { nextSpeed, speedLabel } from "../../../lib/playback";

const btn = {
  border: "1px solid var(--line)",
  background: "var(--bg)",
  borderRadius: 999,
  padding: "6px 12px",
  cursor: "pointer",
  color: "var(--text)",
} as const;

type Props = {
  caption: string;
  playing: boolean;
  onPlayPause: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  volume: number;
  onVolume: (v: number) => void;
  onAsk: (text: string) => void;
  busy: boolean;
};

export default function BottomBar({
  caption,
  playing,
  onPlayPause,
  speed,
  onSpeedChange,
  volume,
  onVolume,
  onAsk,
  busy,
}: Props) {
  const [text, setText] = useState("");
  const { mic, micError, toggleMic } = useMic((t) => setText((p) => (p ? p + " " + t : t)));
  const ok = canSubmit(text, false) && !busy;

  const send = () => {
    if (!ok) return;
    onAsk(text.trim());
    setText("");
  };

  return (
    <div
      data-bottom-bar
      style={{
        display: "flex",
        flexDirection: "column",
        borderTop: "1px solid var(--line)",
        background: "var(--bg)",
      }}
    >
      {/* Main Bottom Controls (No scrubber anywhere) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--blue)",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {caption}
          </p>
        </div>

        {/* Play / Pause */}
        <button aria-label={playing ? "Pause" : "Play"} style={btn} onClick={onPlayPause}>
          {playing ? "❚❚" : "▶"}
        </button>

        {/* Speed toggle */}
        <button
          aria-label="Playback speed"
          style={btn}
          onClick={() => onSpeedChange(nextSpeed(speed))}
        >
          {speedLabel(speed)}
        </button>

        {/* Volume */}
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          style={{ width: 70 }}
        />

        {/* Ask doubt input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "4px 6px 4px 14px",
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={micError || "Type your question or response"}
            disabled={busy}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--text)",
              fontSize: 14,
            }}
          />
          <button
            aria-label={mic === "rec" ? "Stop recording" : "Record"}
            onClick={toggleMic}
            disabled={mic === "busy"}
            style={{
              ...btn,
              border: "none",
              color: mic === "rec" ? "#d33" : "var(--muted)",
            }}
          >
            ●
          </button>
          <button
            aria-label="Send"
            onClick={send}
            disabled={!ok}
            style={{
              ...btn,
              background: ok ? "var(--text)" : "var(--line)",
              color: "var(--bg)",
              border: "none",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
