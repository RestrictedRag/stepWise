"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "katex/dist/katex.min.css";
import { renderShape } from "./shapes";
import AnimatedVector from "./AnimatedVector";
import AnimatedBoardText from "./AnimatedBoardText";
import WholeNoteHighlighter from "./WholeNoteHighlighter";
import VirtualStylus from "./VirtualStylus";
import { calcCommandProgress, getShapesViewBox } from "../../../lib/liveboard/vectorProgress";
import { boardText } from "../../../lib/liveboard/reveal";
import { layoutBlocks, type PlacedBlock } from "../../../lib/liveboard/layout";
import { followCamera, zoomAt, panBy, locate, type Camera } from "../../../lib/liveboard/camera";
import type { BoardBlock } from "./useLessonPlayer";

interface LiveBoardProps {
  blocks: BoardBlock[];
  revealed: Record<string, number>;
  stepElapsedMs?: Record<string, number>;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  onAsk?: (text: string) => void;
}

export default function LiveBoard({
  blocks,
  revealed,
  stepElapsedMs,
  follow,
  onFollowChange,
  onAsk,
}: LiveBoardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 700,
  });

  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const touchPointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist = useRef<number | null>(null);

  // ResizeObserver on the viewport div
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setViewportSize({
          width: e.contentRect.width || 1000,
          height: e.contentRect.height || 700,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute placed blocks grouped by columnIndex
  const placedBlocks = useMemo(() => {
    // Group blocks by column
    const colGroups = new Map<number, BoardBlock[]>();
    for (const b of blocks) {
      const col = b.columnIndex || 0;
      if (!colGroups.has(col)) colGroups.set(col, []);
      colGroups.get(col)!.push(b);
    }

    const allPlaced: Array<BoardBlock & PlacedBlock> = [];
    const sortedCols = Array.from(colGroups.keys()).sort((a, b) => a - b);

    for (const col of sortedCols) {
      const colBlocks = colGroups.get(col)!;
      const placed = layoutBlocks(colBlocks, col, measuredHeights);
      allPlaced.push(...placed);
    }

    return allPlaced;
  }, [blocks, measuredHeights]);

  // While follow is true, automatically follow the newest block
  useEffect(() => {
    if (!follow || placedBlocks.length === 0) return;
    const newest = placedBlocks[placedBlocks.length - 1];
    if (newest) {
      setCam((prev) => followCamera(newest, viewportSize, prev.scale));
    }
  }, [follow, placedBlocks, viewportSize]);

  // Pointer drag events for panning
  const handlePointerDown = (e: React.PointerEvent) => {
    // Avoid dragging when clicking inside interactive buttons or inputs
    if ((e.target as HTMLElement).closest("button, input, textarea, a")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    onFollowChange(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setCam((c) => panBy(c, dx, dy));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStart.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      dragStart.current = null;
      setIsDragging(false);
    }
  };

  // Non-passive wheel zoom around cursor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const delta = -e.deltaY * 0.0015;
      setCam((c) => zoomAt(c, pointer, delta));
      onFollowChange(false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onFollowChange]);

  // Touch handlers for mobile pan & pinch-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea, a")) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      touchPointers.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      lastPinchDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
    onFollowChange(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const prev = touchPointers.current.get(t.identifier);
      if (prev) {
        const dx = t.clientX - prev.x;
        const dy = t.clientY - prev.y;
        touchPointers.current.set(t.identifier, { x: t.clientX, y: t.clientY });
        setCam((c) => panBy(c, dx, dy));
      }
    } else if (e.touches.length === 2 && viewportRef.current) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const rect = viewportRef.current.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      if (lastPinchDist.current !== null && lastPinchDist.current > 0) {
        const delta = (dist - lastPinchDist.current) * 0.005;
        setCam((c) => zoomAt(c, { x: midX, y: midY }, delta));
      }
      lastPinchDist.current = dist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      touchPointers.current.delete(e.changedTouches[i].identifier);
    }
    if (e.touches.length < 2) {
      lastPinchDist.current = null;
    }
  };

  // Recenter handler
  const handleRecenter = () => {
    onFollowChange(true);
    if (placedBlocks.length > 0) {
      const newest = placedBlocks[placedBlocks.length - 1];
      setCam((prev) => followCamera(newest, viewportSize, prev.scale));
    }
  };

  // Locate block from transcript
  const handleLocate = (block: BoardBlock & PlacedBlock) => {
    onFollowChange(false);
    setCam(locate(block, viewportSize, cam));
  };

  return (
    <div
      ref={viewportRef}
      data-board
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "none",
        background: "var(--bg-board, #fbfbfd)",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* World DOM container */}
      <div
        id="board-world"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          transform: `translate3d(${cam.x}px, ${cam.y}px, 0px) scale(${cam.scale})`,
          transition: isDragging
            ? "none"
            : "transform 1s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        {placedBlocks.map((b) => (
          <BlockItem
            key={b.id}
            block={b}
            revealedCount={revealed[b.id] ?? 0}
            elapsedMs={stepElapsedMs?.[b.id] ?? (revealed[b.id] === Infinity ? Infinity : 0)}
            onMeasure={(h) => {
              setMeasuredHeights((prev) => {
                if (prev[b.id] === h) return prev;
                return { ...prev, [b.id]: h };
              });
            }}
          />
        ))}
      </div>

      {/* Recenter Button: appears when follow === false */}
      {!follow && (
        <button
          onClick={handleRecenter}
          aria-label="Recenter"
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg, #fff)",
            border: "1px solid var(--line, #e2e8f0)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            borderRadius: 999,
            padding: "8px 20px",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text, #1e293b)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 30,
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: 16 }}>◎</span> Recenter
        </button>
      )}

      {/* Transcript Drawer Toggle Button */}
      <button
        onClick={() => setShowTranscript((v) => !v)}
        aria-label="Toggle transcript"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "var(--bg, #fff)",
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text, #1e293b)",
          cursor: "pointer",
          zIndex: 30,
        }}
      >
        {showTranscript ? "Hide Transcript" : "Transcript"}
      </button>

      {/* Transcript List Panel */}
      {showTranscript && (
        <aside
          aria-label="Transcript list"
          style={{
            position: "absolute",
            top: 52,
            right: 16,
            width: 320,
            maxHeight: "calc(100% - 100px)",
            background: "var(--bg, #fff)",
            border: "1px solid var(--line, #e2e8f0)",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 30,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--line, #e2e8f0)",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Lesson Transcript</span>
            <span style={{ fontSize: 12, color: "var(--muted, #64748b)" }}>
              {placedBlocks.length} steps
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            {placedBlocks.map((b, idx) => (
              <div
                key={b.id}
                style={{
                  padding: "10px",
                  borderRadius: 8,
                  marginBottom: 6,
                  border: "1px solid var(--line, #f1f5f9)",
                  background: "var(--card-bg, #f8fafc)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--blue, #2563eb)",
                    }}
                  >
                    Column {b.columnIndex + 1} • Step {b.stepIndex + 1}
                  </span>
                  <button
                    onClick={() => handleLocate(b)}
                    aria-label={`Locate step ${b.stepIndex + 1}`}
                    style={{
                      border: "1px solid var(--line, #cbd5e1)",
                      background: "var(--bg, #fff)",
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontSize: 11,
                      cursor: "pointer",
                      color: "var(--text, #334155)",
                    }}
                  >
                    Locate
                  </button>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: "var(--text, #1e293b)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {b.transcript}
                </p>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

/**
 * Individual whiteboard block item.
 * Measured with ResizeObserver to supply height back to layoutBlocks.
 */
function BlockItem({
  block,
  revealedCount,
  elapsedMs,
  onMeasure,
}: {
  block: BoardBlock & PlacedBlock;
  revealedCount: number;
  elapsedMs: number;
  onMeasure: (h: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [penPos, setPenPos] = useState<{ x: number; y: number } | null>(null);
  const [diagramFailed, setDiagramFailed] = useState(false);
  const diagram = diagramFailed ? undefined : block.diagram;
  const diagramSrc = useMemo(
    () => (diagram ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagram.svg)}` : ""),
    [diagram]
  );

  const handleTipMove = useCallback((tip: { x: number; y: number } | null) => {
    const el = ref.current;
    if (!tip || !el) {
      setPenPos(null);
      return;
    }
    // tip is in viewport pixels; the block lives inside the scaled, translated #board-world.
    const r = el.getBoundingClientRect();
    const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
    const x = (tip.x - r.left) / scale;
    const y = (tip.y - r.top) / scale;
    setPenPos((p) => (p && Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 ? p : { x, y }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const height = Math.ceil(e.borderBoxSize?.[0]?.blockSize || el.offsetHeight);
        if (height > 0) onMeasure(height);
      }
    });
    ro.observe(el);
    onMeasure(el.offsetHeight);
    return () => ro.disconnect();
  }, [onMeasure]);

  // Compute revealed text slice
  const fullText = boardText(block);

  // Visual SVG DRAW commands in this block
  const drawCommands = useMemo(() => {
    if (!block.commands) return [];
    return block.commands.filter((c) => c.action === "DRAW" && c.shape);
  }, [block.commands]);

  // Compute dynamic tight-fitted viewBox for diagram shapes
  const vb = useMemo(() => {
    return getShapesViewBox(drawCommands.map((c) => c.shape));
  }, [drawCommands]);

  // Check for any active HIGHLIGHT commands in block
  const isHighlighted = useMemo(() => {
    if (!block.commands) return false;
    const highlightCmds = block.commands.filter((c) => c.action === "HIGHLIGHT");
    if (highlightCmds.length === 0) return false;
    return highlightCmds.some((c) => {
      const p = calcCommandProgress(elapsedMs, c.startMs ?? 0, c.durationMs ?? 1000);
      return p > 0;
    });
  }, [block.commands, elapsedMs]);

  return (
    <div
      ref={ref}
      aria-label={`Board block ${block.columnIndex}-${block.stepIndex}`}
      data-block-id={block.id}
      style={{
        position: "absolute",
        left: block.x,
        top: block.y,
        width: block.w,
        boxSizing: "border-box",
        background: "transparent",
        color: "var(--ink-black, #293749)",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
        paddingBottom: 24,
      }}
    >
      {/* Block Header if title provided */}
      {block.title && (
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--ink-blue, #1e40af)",
            letterSpacing: "-0.01em",
          }}
        >
          {block.title}
        </h3>
      )}

      {/* Rendered HTML Typography & KaTeX formulas via AnimatedBoardText */}
      <div style={{ position: "relative" }}>
        {isHighlighted && <WholeNoteHighlighter progress={1.0} />}
        <AnimatedBoardText
          text={fullText}
          revealedCount={revealedCount}
          onTipMove={handleTipMove}
        />
      </div>

      {/* Inline SVG shapes or model-drawn SVG picture */}
      {diagram ? (
        <div style={{ marginTop: 16 }}>
          {/* <img> on purpose: the browser runs no script and loads no outside file for an SVG shown this way. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diagramSrc}
            alt={diagram.alt}
            onError={() => setDiagramFailed(true)}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: 480,
              objectFit: "contain",
              animation: "board-fade-in 400ms ease-out both",
            }}
          />
        </div>
      ) : drawCommands.length > 0 && (
        <div style={{ marginTop: 16, position: "relative" }}>
          <svg
            viewBox={vb.viewBox}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: 480,
              overflow: "visible",
              animation: "board-fade-in 400ms ease-out both",
            }}
          >
            {drawCommands.map((cmd, i) => (
              <AnimatedVector
                key={cmd.id || i}
                shape={cmd.shape}
                progress={1}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Checkpoint question card if present */}
      {block.checkpoint && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            background: "var(--card-bg, #f8fafc)",
            border: "1px solid var(--blue, #3b82f6)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            {block.checkpoint.question}
          </div>
          {Array.isArray(block.checkpoint.options) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {block.checkpoint.options.map((opt: string, optIdx: number) => (
                <button
                  key={optIdx}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line, #cbd5e1)",
                    background: "var(--bg, #fff)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {penPos && <VirtualStylus x={penPos.x} y={penPos.y} active />}
    </div>
  );
}

