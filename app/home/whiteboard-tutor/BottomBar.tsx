"use client";

import { useState, useRef } from "react";
import { useMic } from "../../useMic";
import { canSubmit } from "../../../lib/modes";

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
  volume: number;
  onVolume: (v: number) => void;
  onAsk: (text: string) => void;
  busy: boolean;
  progress?: number;
  durationMs?: number;
  timeMs?: number;
  onScrubStart?: () => void;
  onScrub?: (progress: number) => void;
  onScrubEnd?: () => void;
};

export default function BottomBar({
  caption,
  playing,
  onPlayPause,
  volume,
  onVolume,
  onAsk,
  busy,
  progress = 0,
  durationMs = 0,
  timeMs = 0,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: Props) {
  const [text, setText] = useState("");
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const { mic, micError, toggleMic } = useMic((t) => setText((p) => (p ? p + " " + t : t)));
  const ok = canSubmit(text, false) && !busy;
  const send = () => {
    if (!ok) return;
    onAsk(text.trim());
    setText("");
  };

  const getProgressFromEvent = (e: React.PointerEvent) => {
    if (!scrubberRef.current) return 0;
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  };

  const formatSec = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? "0" : ""}${rem}`;
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
      {/* Interactive Timeline Scrubber */}
      {durationMs > 0 && onScrub && (
        <div
          ref={scrubberRef}
          aria-label="Timeline scrubber"
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            position: "relative",
            width: "100%",
            height: 8,
            background: "var(--line)",
            cursor: "ew-resize",
            touchAction: "none",
          }}
          onPointerDown={(e) => {
            isDragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onScrubStart?.();
            const p = getProgressFromEvent(e);
            onScrub(p);
          }}
          onPointerMove={(e) => {
            if (!isDragging.current) return;
            const p = getProgressFromEvent(e);
            onScrub(p);
          }}
          onPointerUp={() => {
            if (isDragging.current) {
              isDragging.current = false;
              onScrubEnd?.();
            }
          }}
          onPointerCancel={() => {
            if (isDragging.current) {
              isDragging.current = false;
              onScrubEnd?.();
            }
          }}
        >
          {/* Progress fill */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.max(0, Math.min(100, progress * 100))}%`,
              background: "var(--blue)",
              transition: isDragging.current ? "none" : "width 0.1s linear",
            }}
          />
          {/* Scrubber thumb */}
          <div
            style={{
              position: "absolute",
              left: `${Math.max(0, Math.min(100, progress * 100))}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "var(--blue)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Main Bottom Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px" }}>
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
          {durationMs > 0 && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {formatSec(timeMs)} / {formatSec(durationMs)}
            </span>
          )}
        </div>

        <button aria-label={playing ? "Pause" : "Play"} style={btn} onClick={onPlayPause}>
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          style={{ width: 80 }}
        />

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
