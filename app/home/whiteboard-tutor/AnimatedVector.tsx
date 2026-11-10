"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Shape } from "../../../lib/board";
import { isStroke, renderShape } from "./shapes";

interface AnimatedVectorProps {
  shape: Shape;
  progress: number; // 0.0 to 1.0
  onTipMove?: (point: { x: number; y: number } | null) => void;
}

export default function AnimatedVector({
  shape,
  progress,
  onTipMove,
}: AnimatedVectorProps) {
  const gRef = useRef<SVGGElement>(null);
  const [pathLen, setPathLen] = useState<number | null>(null);

  // Measure path total length in user coordinates for precision stylus tip tracking
  useEffect(() => {
    if (!gRef.current) return;
    const pathEl = gRef.current.querySelector<SVGGeometryElement>("path");
    if (pathEl && typeof pathEl.getTotalLength === "function") {
      try {
        const l = pathEl.getTotalLength();
        if (l > 0) setPathLen(l);
      } catch {}
    }
  }, [shape]);

  const stroke = isStroke(shape);
  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Precision stylus contact point tracking
  useEffect(() => {
    if (!onTipMove || clampedProgress >= 1 || clampedProgress <= 0 || !gRef.current) {
      if (onTipMove && (clampedProgress >= 1 || clampedProgress <= 0)) {
        onTipMove(null);
      }
      return;
    }

    if (shape.type === "arrow") {
      const paths = gRef.current.querySelectorAll<SVGGeometryElement>("path");
      if (paths.length >= 2) {
        try {
          if (clampedProgress <= 0.75) {
            const shaftLen = paths[0].getTotalLength();
            const shaftP = clampedProgress / 0.75;
            const pt = paths[0].getPointAtLength(shaftLen * shaftP);
            onTipMove({ x: pt.x, y: pt.y });
          } else {
            const headLen = paths[1].getTotalLength();
            const headP = (clampedProgress - 0.75) / 0.25;
            const pt = paths[1].getPointAtLength(headLen * headP);
            onTipMove({ x: pt.x, y: pt.y });
          }
          return;
        } catch {}
      }
    }

    const pathEl = gRef.current.querySelector<SVGGeometryElement>("path");
    if (pathEl && typeof pathEl.getPointAtLength === "function" && pathLen) {
      try {
        const pt = pathEl.getPointAtLength(pathLen * clampedProgress);
        onTipMove({ x: pt.x, y: pt.y });
      } catch {}
    }
  }, [clampedProgress, pathLen, shape.type, onTipMove]);

  // Arrow sequencing: shaft first (0 - 75%), head second (75% - 100%)
  useEffect(() => {
    if (shape.type !== "arrow" || !gRef.current) return;
    const paths = gRef.current.querySelectorAll<SVGGeometryElement>("path");
    if (paths.length >= 2) {
      const shaft = paths[0];
      const head = paths[1];

      if (clampedProgress >= 1) {
        shaft.style.strokeDasharray = "none";
        shaft.style.strokeDashoffset = "none";
        head.style.strokeDasharray = "none";
        head.style.strokeDashoffset = "none";
      } else {
        const shaftP = Math.min(1, clampedProgress / 0.75);
        shaft.style.strokeDasharray = "1.05";
        shaft.style.strokeDashoffset = String(Math.max(0, 1.05 * (1 - shaftP)));
        shaft.style.transition = "none";

        const headP = clampedProgress <= 0.75 ? 0 : (clampedProgress - 0.75) / 0.25;
        head.style.strokeDasharray = "1.05";
        head.style.strokeDashoffset = String(Math.max(0, 1.05 * (1 - headP)));
        head.style.transition = "none";
      }
    }
  }, [clampedProgress, shape.type]);

  // Hidden before starting
  if (clampedProgress <= 0) {
    return <g ref={gRef} style={{ display: "none" }}>{renderShape(shape)}</g>;
  }

  // Non-arrow stroke shapes use direct pathLength="1" dashoffset normalization
  const strokeStyle: React.CSSProperties = stroke
    ? shape.type === "arrow"
      ? {} // Arrow paths are styled individually in useEffect
      : clampedProgress < 1
      ? {
          strokeDasharray: 1.05,
          strokeDashoffset: Math.max(0, 1.05 * (1 - clampedProgress)),
          transition: "none",
        }
      : {
          strokeDasharray: "none",
          strokeDashoffset: "none",
        }
    : {
        opacity: Math.min(1, clampedProgress * 2),
        transition: clampedProgress >= 1 ? "none" : "opacity 0.15s ease",
      };

  return (
    <g ref={gRef} style={strokeStyle}>
      {renderShape(shape)}
    </g>
  );
}
