"use client";

import React, { useMemo, useRef, useEffect } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { splitTextSegments, type TextSegment } from "../../../lib/liveboard/textPacing";

interface AnimatedBoardTextProps {
  text: string;
  revealedCount: number;
  onTipMove?: (point: { x: number; y: number } | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderFormattedText(str: string): string {
  return esc(str).replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
}

export default function AnimatedBoardText({
  text,
  revealedCount,
  onTipMove,
  className,
  style,
}: AnimatedBoardTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTipRef = useRef<HTMLSpanElement>(null);

  const isComplete = revealedCount === Infinity || revealedCount >= text.length;
  const segments = useMemo(() => splitTextSegments(text), [text]);

  // Report active pen tip coordinate if onTipMove is supplied
  useEffect(() => {
    if (!onTipMove) return;
    if (isComplete) {
      onTipMove(null);
      return;
    }
    const tipEl = activeTipRef.current;
    if (tipEl) {
      const rect = tipEl.getBoundingClientRect();
      onTipMove({ x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.78 });
    }
  }, [revealedCount, isComplete, onTipMove]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        fontSize: 16,
        lineHeight: 1.6,
        wordBreak: "break-word",
        color: "var(--ink-black, #293749)",
        ...style,
      }}
    >
      {segments.map((seg, idx) => {
        // 1. Not yet revealed
        if (!isComplete && revealedCount <= seg.startIdx) {
          return null;
        }

        // 2. Fully revealed segment
        if (isComplete || revealedCount >= seg.endIdx) {
          if (seg.type === "math") {
            const html = katex.renderToString(seg.mathContent || "", {
              displayMode: seg.displayMode,
              throwOnError: false,
            });
            return (
              <span
                key={idx}
                dangerouslySetInnerHTML={{ __html: html }}
                style={{ display: seg.displayMode ? "block" : "inline-block", margin: seg.displayMode ? "10px 0" : "0 2px" }}
              />
            );
          }
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: renderFormattedText(seg.raw) }}
            />
          );
        }

        // 3. Partially revealed segment (active typing / unmasking)
        if (seg.type === "math") {
          const segProgress = Math.max(
            0,
            Math.min(1, (revealedCount - seg.startIdx) / Math.max(1, seg.raw.length))
          );
          const html = katex.renderToString(seg.mathContent || "", {
            displayMode: seg.displayMode,
            throwOnError: false,
          });
          return (
            <span
              key={idx}
              style={{
                display: seg.displayMode ? "block" : "inline-block",
                position: "relative",
                margin: seg.displayMode ? "10px 0" : "0 2px",
              }}
            >
              <span
                style={{
                  display: seg.displayMode ? "block" : "inline-block",
                  clipPath: `inset(0 calc(100% - ${segProgress * 100}%) 0 0)`,
                  willChange: "clip-path",
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <span
                ref={activeTipRef}
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${segProgress * 100}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "transparent",
                  pointerEvents: "none",
                }}
              />
            </span>
          );
        }

        // Partially revealed text
        const charsVisible = Math.max(0, revealedCount - seg.startIdx);
        const visibleSlice = seg.raw.slice(0, charsVisible);

        return (
          <span key={idx}>
            <span dangerouslySetInnerHTML={{ __html: renderFormattedText(visibleSlice) }} />
            <span
              ref={activeTipRef}
              aria-hidden
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "transparent",
                verticalAlign: "middle",
                marginLeft: 4,
                pointerEvents: "none",
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

