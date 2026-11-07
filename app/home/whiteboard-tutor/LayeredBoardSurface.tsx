"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { focusBox, type BoardScript, type Color } from "../../../lib/board";
import { boardScriptToManifest, type LessonManifest, type VectorCommand, type DrawCommand } from "../../../lib/manifest";
import { StepWisePlaybackEngine, type EngineActiveState } from "../../../lib/engine/playbackEngine";
import { isStroke, renderShape } from "./shapes";
import VirtualStylus from "./VirtualStylus";

const PANEL = 1040;
const clamp = (v: number) => Math.min(3, Math.max(0.25, v));
const pill = {
  border: "1px solid var(--line)",
  background: "var(--bg)",
  borderRadius: 999,
  padding: "6px 14px",
  cursor: "pointer",
  color: "var(--text)",
} as const;

interface Props {
  script?: BoardScript;
  manifest?: LessonManifest;
  step: number;
  engine?: StepWisePlaybackEngine | null;
  follow: boolean;
  onFollowChange: (f: boolean) => void;
  asks?: { at: number; text: string }[];
}

export default function LayeredBoardSurface({
  script,
  manifest: rawManifest,
  step,
  engine,
  follow,
  onFollowChange,
  asks,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState({ x: 0, y: 0, s: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const followRef = useRef(onFollowChange);
  followRef.current = onFollowChange;

  const manifest = useMemo<LessonManifest | null>(() => {
    if (rawManifest) return rawManifest;
    if (script) return boardScriptToManifest(script);
    return null;
  }, [rawManifest, script]);

  const [activeEngineState, setActiveEngineState] = useState<EngineActiveState | null>(null);

  useEffect(() => {
    if (!engine) {
      setActiveEngineState(null);
      return;
    }
    const unsub = engine.subscribe((state) => {
      setActiveEngineState(state);
    });
    return unsub;
  }, [engine]);

  // ResizeObserver & native wheel listener
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setCam((c) => {
        const s2 = clamp(c.s * Math.exp(-e.deltaY * 0.001));
        return { x: c.x + mx / c.s - mx / s2, y: c.y + my / c.s - my / s2, s: s2 };
      });
      followRef.current(false);
    };

    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  const currentStep = manifest?.steps[step];

  // Camera follow logic
  useEffect(() => {
    if (!follow || !size.w || !currentStep) return;

    // Check if an engine CAMERA_ZOOM viewport is active
    if (activeEngineState?.cameraViewport) {
      const { x, y, width, height } = activeEngineState.cameraViewport;
      const x0 = x + step * PANEL;
      const s = Math.min(size.w / width, size.h / height);
      setCam({ x: x0 + width / 2 - size.w / (2 * s), y: y + height / 2 - size.h / (2 * s), s });
      return;
    }

    // Default focusBox centering
    const shapes = currentStep.commands
      .filter((c): c is DrawCommand => c.action === "DRAW")
      .map((c) => c.shape as any);

    const [bx, by, bw, bh] = focusBox(shapes);
    const x0 = bx + step * PANEL;
    const s = Math.min(size.w / bw, size.h / bh);
    setCam({ x: x0 + bw / 2 - size.w / (2 * s), y: by + bh / 2 - size.h / (2 * s), s });
  }, [follow, step, size, currentStep, activeEngineState?.cameraViewport]);

  function zoomBy(f: number) {
    setCam((c) => {
      const s2 = clamp(c.s * f);
      const mx = size.w / 2;
      const my = size.h / 2;
      return { x: c.x + mx / c.s - mx / s2, y: c.y + my / c.s - my / s2, s: s2 };
    });
    onFollowChange(false);
  }

  if (!manifest) return null;

  const activeColor: Color = "ink";

  return (
    <div
      ref={box}
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        background: "var(--board)",
        cursor: drag.current ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        if ((e.target as Element).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!dx && !dy) return;
        drag.current = { x: e.clientX, y: e.clientY };
        setCam((c) => ({ ...c, x: c.x - dx / c.s, y: c.y - dy / c.s }));
        onFollowChange(false);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      data-board
    >
      <svg width="100%" height="100%" style={{ display: "block" }}>
        {/* Layer 0: Mask Definitions for Eraser Layer */}
        <defs id="layer-eraser-masks">
          {activeEngineState?.erasedElementIds && (
            <clipPath id="eraser-clip-all">
              <rect x="-9999" y="-9999" width="0" height="0" />
            </clipPath>
          )}
        </defs>

        <g
          style={{
            transform: `scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`,
            transformOrigin: "0 0",
            transition: follow ? "transform .8s ease" : "none",
          }}
        >
          {/* Layer 1: Static Background Layer */}
          <g id="layer-bg">
            <text x={40} y={60} className="font-board" fontSize={40} fill="var(--board-title)">
              {manifest.title}
            </text>
            {manifest.subtitle && (
              <text x={40} y={95} className="font-board" fontSize={22} fill="var(--muted)">
                {manifest.subtitle}
              </text>
            )}

            {asks?.map((a, k) => (
              <g key={"ask" + k} transform={`translate(${a.at * PANEL + 40},130)`}>
                <rect width={360} height={56} rx={12} fill="var(--bg)" stroke="var(--line)" />
                <text x={14} y={20} fontSize={11} fill="var(--muted)">
                  YOUR QUESTION
                </text>
                <text x={14} y={42} fontSize={15} fill="var(--text)">
                  {a.text}
                </text>
              </g>
            ))}
          </g>

          {/* Layer 2: Dynamic Vector Layer */}
          <g id="layer-vectors">
            {manifest.steps.slice(0, step + 1).map((st, i) => {
              const isPastStep = i < step;

              return (
                <g key={`step-${i}`} transform={`translate(${i * PANEL},0)`}>
                  {st.commands.map((cmd) => {
                    if (cmd.action !== "DRAW") return null;

                    // If erased in active state, hide it
                    if (!isPastStep && activeEngineState?.erasedElementIds.has(cmd.id)) {
                      return null;
                    }

                    const isCompleted = isPastStep || Boolean(activeEngineState?.completedCommandIds.has(cmd.id));
                    const isActive = !isPastStep && Boolean(activeEngineState?.activeCommandIds.has(cmd.id));

                    // If neither completed nor active, command hasn't occurred yet
                    if (!isCompleted && !isActive) return null;

                    const shapeObj = cmd.shape as any;
                    const stroke = isStroke(shapeObj);

                    return (
                      <g
                        key={cmd.id}
                        id={`vector-${cmd.id}`}
                        style={{
                          opacity: isCompleted ? 1 : isActive ? 1 : 0,
                          transition: stroke ? "none" : "opacity 0.3s ease",
                        }}
                      >
                        {renderShape(shapeObj)}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* Layer 3: Interactive Annotation Layer (Highlights & Stylus) */}
          <g id="layer-annotations" transform={`translate(${step * PANEL},0)`}>
            {/* Dynamic Highlights */}
            {activeEngineState &&
              Array.from(activeEngineState.highlightedElementIds.entries()).map(([elemId, hl]) => (
                <g key={`hl-${elemId}`} opacity={hl.intensity}>
                  {/* Subtle pulsing highlight halo */}
                  <circle cx={500} cy={350} r={120} fill="var(--ink-orange)" opacity={0.15 * hl.intensity} />
                </g>
              ))}

            {/* Virtual Stylus */}
            {activeEngineState?.stylusPosition && (
              <VirtualStylus
                x={activeEngineState.stylusPosition.x}
                y={activeEngineState.stylusPosition.y}
                active={activeEngineState.stylusPosition.active}
                color={activeColor}
              />
            )}
          </g>
        </g>
      </svg>

      {/* Viewport Zoom & Follow Controls */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "2px 6px",
        }}
      >
        <button
          aria-label="Zoom out"
          style={{ ...pill, border: "none", padding: "2px 8px" }}
          onClick={() => zoomBy(1 / 1.2)}
        >
          −
        </button>
        <span style={{ minWidth: 44, textAlign: "center", fontSize: 13 }}>
          {Math.round(cam.s * 100) + "%"}
        </span>
        <button
          aria-label="Zoom in"
          style={{ ...pill, border: "none", padding: "2px 8px" }}
          onClick={() => zoomBy(1.2)}
        >
          +
        </button>
      </div>

      {!follow && (
        <button
          style={{
            ...pill,
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
          }}
          onClick={() => onFollowChange(true)}
        >
          Follow tutor
        </button>
      )}
    </div>
  );
}

