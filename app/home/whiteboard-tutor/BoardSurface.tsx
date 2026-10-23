"use client";

import { useEffect, useRef, useState } from "react";
import { focusBox, type BoardScript } from "../../../lib/board";
import { shapeDelays } from "../../../lib/sync";
import { isStroke, renderShape } from "./shapes";

const PANEL = 1040;
const clamp = (v: number) => Math.min(3, Math.max(0.25, v));
const pill = { border: "1px solid var(--line)", background: "var(--bg)", borderRadius: 999, padding: "6px 14px", cursor: "pointer", color: "var(--text)" } as const;

type Props = { script: BoardScript; step: number; clipSeconds: number; follow: boolean; onFollowChange: (f: boolean) => void };

export default function BoardSurface({ script, step, clipSeconds, follow, onFollowChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState({ x: 0, y: 0, s: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const followRef = useRef(onFollowChange);
  followRef.current = onFollowChange;

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    // native listener: React's onWheel is passive, so preventDefault would be ignored
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setCam((c) => {
        const s2 = clamp(c.s * Math.exp(-e.deltaY * 0.001));
        return { x: c.x + mx / c.s - mx / s2, y: c.y + my / c.s - my / s2, s: s2 };
      });
      followRef.current(false);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener("wheel", wheel); };
  }, []);

  const current = script.steps[step];
  useEffect(() => {
    if (!follow || !size.w || !current) return;
    const [bx, by, bw, bh] = focusBox(current.draw);
    const x0 = bx + step * PANEL;
    const s = Math.min(size.w / bw, size.h / bh);
    setCam({ x: x0 + bw / 2 - size.w / (2 * s), y: by + bh / 2 - size.h / (2 * s), s });
  }, [follow, step, size, current]);

  function zoomBy(f: number) {
    setCam((c) => {
      const s2 = clamp(c.s * f);
      const mx = size.w / 2, my = size.h / 2;
      return { x: c.x + mx / c.s - mx / s2, y: c.y + my / c.s - my / s2, s: s2 };
    });
    onFollowChange(false);
  }

  const delays = current ? shapeDelays(current, clipSeconds) : [];

  return (
    <div
      ref={box}
      style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", background: "var(--board)", cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
      onPointerDown={(e) => {
        // capture would retarget the click away from the pill/zoom buttons
        if ((e.target as Element).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!dx && !dy) return;
        drag.current = { x: e.clientX, y: e.clientY };
        setCam((c) => ({ ...c, x: c.x - dx / c.s, y: c.y - dy / c.s }));
        onFollowChange(false);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      data-board
    >
      <svg width="100%" height="100%" style={{ display: "block" }}>
        <g style={{ transform: `scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`, transformOrigin: "0 0", transition: follow ? "transform .8s ease" : "none" }}>
          <text x={40} y={60} className="font-board" fontSize={40} fill="var(--board-title)">{script.title}</text>
          {script.subtitle && <text x={40} y={95} className="font-board" fontSize={22} fill="var(--muted)">{script.subtitle}</text>}
          {script.steps.slice(0, step + 1).map((st, i) => (
            <g key={i} transform={`translate(${i * PANEL},0)`}>
              {st.draw.map((s, j) =>
                i < step ? (
                  <g key={j}>{renderShape(s)}</g>
                ) : (
                  <g key={`${step}-${j}`} className={isStroke(s) ? "draw" : "fade"} style={{ animationDelay: `${delays[j] ?? 0}s` }}>{renderShape(s)}</g>
                ),
              )}
            </g>
          ))}
        </g>
      </svg>
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 6, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "2px 6px" }}>
        <button aria-label="Zoom out" style={{ ...pill, border: "none", padding: "2px 8px" }} onClick={() => zoomBy(1 / 1.2)}>−</button>
        <span style={{ minWidth: 44, textAlign: "center", fontSize: 13 }}>{Math.round(cam.s * 100) + "%"}</span>
        <button aria-label="Zoom in" style={{ ...pill, border: "none", padding: "2px 8px" }} onClick={() => zoomBy(1.2)}>+</button>
      </div>
      {!follow && (
        <button style={{ ...pill, position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)" }} onClick={() => onFollowChange(true)}>Follow tutor</button>
      )}
    </div>
  );
}
