"use client";

import React from "react";

export interface WholeNoteHighlighterProps {
  progress?: number; // 0.0 to 1.0
  color?: string; // translucent highlighter ink
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Authentic Solvely highlighter sweep animation across text or formulas.
 * Uses soft translucent ink with mix-blend-mode: multiply.
 */
export default function WholeNoteHighlighter({
  progress = 1.0,
  color = "rgba(254, 240, 138, 0.6)",
  children,
  className,
  style,
}: WholeNoteHighlighterProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  if (!children) {
    return (
      <span
        aria-hidden
        className={className}
        style={{
          display: "block",
          position: "absolute",
          left: 0,
          top: "15%",
          height: "70%",
          width: `${clampedProgress * 100}%`,
          background: color,
          borderRadius: 4,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          willChange: "width",
          ...style,
        }}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          bottom: "8%",
          height: "65%",
          width: `${clampedProgress * 100}%`,
          background: color,
          borderRadius: 4,
          mixBlendMode: "multiply",
          pointerEvents: "none",
          willChange: "width",
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

