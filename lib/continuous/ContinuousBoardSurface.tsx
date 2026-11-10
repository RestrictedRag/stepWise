// Continuous Whiteboard Surface Component
// Renders the pure deterministic whiteboard engine with DOM pre-pass measurement,
// wobbly hand-drawn marker strokes, progressive clip/stroke reveals, and smooth keyframe camera.

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  ContinuousLesson,
  ColorToken,
  ElementDimensions,
  SolvedLayout,
  ResolvedRenderElement,
  ResolvedRenderConnector,
  ActiveAnnotation,
} from "./types.ts";
import { solveContinuousLayout } from "./layoutSolver.ts";
import {
  compileContinuousTimeline,
  computeContinuousStateAt,
  type StepTimingSpec,
} from "./playbackEngine.ts";
import { sketchRect, sketchEllipse, sketchArrow, sketchLine } from "../sketch.ts";
import { mathText } from "../mathtext.ts";

export interface ContinuousBoardSurfaceProps {
  lesson: ContinuousLesson;
  currentTimeMs: number;
  stepTimings?: StepTimingSpec[];
  width?: number | string;
  height?: number | string;
  className?: string;
  onLayoutComputed?: (layout: SolvedLayout) => void;
}

const COLOR_MAP: Record<ColorToken, string> = {
  default: "#1e293b", // Slate charcoal
  accent: "#2563eb",  // Royal blue
  muted: "#94a3b8",   // Soft graphite gray
  warn: "#ea580c",    // Energetic amber/orange
  success: "#16a34a", // Organic forest green
};

const FONT_SIZES = {
  sm: 16,
  md: 20,
  lg: 26,
};

export function ContinuousBoardSurface({
  lesson,
  currentTimeMs,
  stepTimings,
  width = "100%",
  height = 700,
  className = "",
  onLayoutComputed,
}: ContinuousBoardSurfaceProps) {
  const measurerRef = useRef<HTMLDivElement>(null);
  const [measuredSizes, setMeasuredSizes] = useState<Map<string, ElementDimensions>>(new Map());
  const [hasMeasured, setHasMeasured] = useState(false);

  // 1. Browser Pre-Pass: Measure text and formula boxes in the DOM
  useEffect(() => {
    if (!measurerRef.current) return;

    const sizes = new Map<string, ElementDimensions>();
    const measureNodes = measurerRef.current.querySelectorAll<HTMLElement>("[data-measure-id]");

    measureNodes.forEach((node) => {
      const id = node.getAttribute("data-measure-id");
      if (!id) return;

      const rect = node.getBoundingClientRect();
      const dims: ElementDimensions = {
        width: Math.ceil(rect.width) + 8,
        height: Math.ceil(rect.height) + 4,
      };

      // If it's a math element, look for relational operator (e.g. '=') to measure eqRelX
      const relNode = node.querySelector<HTMLElement>(".mrel");
      if (relNode) {
        const relRect = relNode.getBoundingClientRect();
        dims.eqRelX = Math.round(relRect.left - rect.left + relRect.width / 2);
      }

      sizes.set(id, dims);
    });

    setMeasuredSizes(sizes);
    setHasMeasured(true);
  }, [lesson]);

  // 2. Solve Layout statically across the entire lesson
  const layout = useMemo(() => {
    const solved = solveContinuousLayout(lesson, measuredSizes.size > 0 ? measuredSizes : undefined);
    if (onLayoutComputed) {
      onLayoutComputed(solved);
    }
    return solved;
  }, [lesson, measuredSizes, onLayoutComputed]);

  // 3. Compile timeline with timestamps and camera trajectory
  const timeline = useMemo(() => {
    return compileContinuousTimeline(lesson, layout, stepTimings);
  }, [lesson, layout, stepTimings]);

  // 4. Pure state evaluation at currentTimeMs
  const state = useMemo(() => {
    return computeContinuousStateAt(timeline, currentTimeMs);
  }, [timeline, currentTimeMs]);

  // Camera transform in SVG coordinate space
  // Viewport nominal center is (500, 350)
  const cameraTransform = `translate(500, 350) scale(${state.camera.zoom}) translate(${-state.camera.cx}, ${-state.camera.cy})`;

  return (
    <div
      className={`relative select-none overflow-hidden rounded-xl bg-[#fcfbf7] border border-amber-900/10 shadow-sm ${className}`}
      style={{ width, height }}
    >
      {/* Offscreen DOM Measurer Container */}
      <div
        ref={measurerRef}
        className="pointer-events-none absolute -left-[9999px] -top-[9999px] invisible"
        aria-hidden="true"
      >
        {lesson.steps.flatMap((step) =>
          step.ops.flatMap((op) => {
            if (op.op !== "DRAW") return [];
            const el = op.element;
            if (el.type === "text") {
              const fSize = FONT_SIZES[el.size ?? "md"];
              return [
                <div
                  key={`measure_${el.id}`}
                  data-measure-id={el.id}
                  style={{
                    fontSize: `${fSize}px`,
                    fontFamily: "var(--font-board, 'Caveat', cursive, sans-serif)",
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    padding: "4px 8px",
                  }}
                >
                  {el.text}
                </div>,
              ];
            }
            if (el.type === "latex") {
              return [
                <div
                  key={`measure_${el.id}`}
                  data-measure-id={el.id}
                  style={{
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    padding: "6px 12px",
                  }}
                  dangerouslySetInnerHTML={{ __html: mathText(el.math) }}
                />,
              ];
            }
            return [];
          })
        )}
      </div>

      {/* Main SVG Board Surface */}
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* Subtle whiteboard grid pattern */}
        <defs>
          <pattern id="whiteboard-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.75" fill="#e2e0d8" />
          </pattern>
        </defs>
        <rect width="1000" height="700" fill="url(#whiteboard-grid)" />

        {/* Camera Transformed Scene */}
        <g transform={cameraTransform}>
          {/* Layer 1: Connectors */}
          {state.connectors.map((rc) => (
            <RenderConnector key={rc.id} item={rc} />
          ))}

          {/* Layer 2: Shapes, Text, and LaTeX Elements */}
          {state.elements.map((re) => (
            <RenderElement key={re.id} item={re} />
          ))}

          {/* Layer 3: Active Annotations (Circle, Underline, Strike, Point) */}
          {state.annotations.map((ann) => (
            <RenderAnnotation key={ann.id} ann={ann} />
          ))}
        </g>
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Element Renderers
// -----------------------------------------------------------------------------

function RenderElement({ item }: { item: ResolvedRenderElement }) {
  const { solved, opacity, drawProgress } = item;
  const { element, bounds } = solved;
  const color = COLOR_MAP[element.color ?? "default"];

  if (opacity <= 0 || drawProgress <= 0) return null;

  if (element.type === "shape") {
    let pathD = "";
    if (element.shapeType === "rect") {
      pathD = sketchRect(bounds.x, bounds.y, bounds.width, bounds.height);
    } else {
      pathD = sketchEllipse(solved.x, solved.y, bounds.width / 2, bounds.height / 2);
    }

    return (
      <g opacity={opacity}>
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={Math.max(0, 1 - drawProgress)}
        />
        {element.label && drawProgress > 0.4 && (
          <text
            x={solved.x}
            y={solved.y + (element.shapeType === "rect" ? 6 : 4)}
            textAnchor="middle"
            fill={color}
            fontSize={18}
            fontFamily="var(--font-board, 'Caveat', cursive, sans-serif)"
            style={{
              clipPath: `inset(0 ${Math.max(0, (1 - (drawProgress - 0.4) / 0.6)) * 100}% 0 0)`,
            }}
          >
            {element.label}
          </text>
        )}
      </g>
    );
  }

  if (element.type === "text") {
    const fSize = FONT_SIZES[element.size ?? "md"];
    return (
      <foreignObject
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        opacity={opacity}
      >
        <div
          style={{
            color,
            fontSize: `${fSize}px`,
            fontFamily: "var(--font-board, 'Caveat', cursive, sans-serif)",
            whiteSpace: "nowrap",
            clipPath: `inset(0 ${Math.max(0, (1 - drawProgress)) * 100}% 0 0)`,
            lineHeight: 1.2,
          }}
        >
          {element.text}
        </div>
      </foreignObject>
    );
  }

  if (element.type === "latex") {
    return (
      <foreignObject
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        opacity={opacity}
      >
        <div
          style={{
            color,
            whiteSpace: "nowrap",
            clipPath: `inset(0 ${Math.max(0, (1 - drawProgress)) * 100}% 0 0)`,
            transformOrigin: "left center",
          }}
          dangerouslySetInnerHTML={{ __html: mathText(element.math) }}
        />
      </foreignObject>
    );
  }

  return null;
}

function RenderConnector({ item }: { item: ResolvedRenderConnector }) {
  const { solved, opacity, drawProgress } = item;
  const { fromPoint, toPoint, color: colToken, label, style } = solved;
  const color = COLOR_MAP[colToken ?? "default"];

  if (opacity <= 0 || drawProgress <= 0) return null;

  // Calculate intermediate endpoint based on drawProgress
  const curToX = fromPoint.x + (toPoint.x - fromPoint.x) * Math.min(1, drawProgress / 0.85);
  const curToY = fromPoint.y + (toPoint.y - fromPoint.y) * Math.min(1, drawProgress / 0.85);

  const { shaftPath, headPath } = sketchArrow(fromPoint.x, fromPoint.y, curToX, curToY);
  const showHead = drawProgress >= 0.85;

  const midX = (fromPoint.x + toPoint.x) / 2;
  const midY = (fromPoint.y + toPoint.y) / 2;

  return (
    <g opacity={opacity}>
      <path
        d={shaftPath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={style === "dashed" ? "6,5" : undefined}
      />
      {showHead && (
        <path
          d={headPath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {label && drawProgress > 0.5 && (
        <g transform={`translate(${midX}, ${midY - 14})`}>
          <rect
            x={-Math.round(label.length * 4.5 + 8)}
            y={-12}
            width={Math.round(label.length * 9 + 16)}
            height={20}
            rx={4}
            fill="#fcfbf7"
            stroke={color}
            strokeWidth={1}
            opacity={0.9}
          />
          <text
            textAnchor="middle"
            y={3}
            fontSize={13}
            fontFamily="var(--font-board, 'Caveat', cursive, sans-serif)"
            fill={color}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

function RenderAnnotation({ ann }: { ann: ActiveAnnotation }) {
  const { type, bounds, color: colToken, progress, pointCoord } = ann;
  const color = COLOR_MAP[colToken ?? "accent"];

  if (progress <= 0) return null;

  if (type === "CIRCLE") {
    const pad = 14;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = bounds.width / 2 + pad;
    const ry = bounds.height / 2 + pad;
    const pathD = sketchEllipse(cx, cy, rx, ry, 99);

    return (
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={Math.max(0, 1 - progress)}
      />
    );
  }

  if (type === "UNDERLINE") {
    const y = bounds.y + bounds.height + 4;
    const x1 = bounds.x - 4;
    const x2 = bounds.x + bounds.width + 4;
    const pathD = sketchLine(x1, y, x1 + (x2 - x1) * progress, y, 42);

    return (
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  }

  if (type === "STRIKE") {
    const x1 = bounds.x - 6;
    const y1 = bounds.y + bounds.height * 0.7;
    const x2 = bounds.x + bounds.width + 6;
    const y2 = bounds.y + bounds.height * 0.3;
    const pathD = sketchLine(x1, y1, x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress, 77);

    return (
      <path
        d={pathD}
        fill="none"
        stroke="#dc2626" // Vivid red for strike-through
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  }

  if (type === "POINT" && pointCoord) {
    return (
      <g transform={`translate(${pointCoord.x}, ${pointCoord.y})`}>
        {/* Pulsing focal circle */}
        <circle
          r={16 * progress}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={1 - progress * 0.7}
        />
        {/* Small stylus marker tip */}
        <circle r={4} fill={color} />
      </g>
    );
  }

  return null;
}

