"use client";

import React from "react";

interface VirtualStylusProps {
  x: number;
  y: number;
  active?: boolean;
}

export function SvgVirtualStylus({ x, y, active = true }: VirtualStylusProps) {
  if (!active) return null;
  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{
        pointerEvents: "none",
        transition: "transform 0.08s cubic-bezier(0.2, 0.8, 0.3, 1)",
        willChange: "transform",
      }}
    >
      {/* Glowing ink contact dot */}
      <circle cx={0} cy={0} r={4} fill="var(--ink-orange, #e67e22)" />
      {/* Tilted pen sprite */}
      <g transform="translate(2, -18) rotate(-15)">
        <path d="M0 18l3-1 11-11-2-2L1 15l-1 3z" fill="#334155" stroke="#fff" strokeWidth="0.8" />
        <path d="M12 4l2 2" stroke="#cbd5e1" strokeWidth="1" />
        <circle cx="0" cy="18" r="1.5" fill="#e67e22" />
      </g>
    </g>
  );
}

export default function VirtualStylus({ x, y, active = true }: VirtualStylusProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        zIndex: 50,
        transition: "transform 0.12s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.2s ease",
        opacity: active ? 1 : 0,
        transform: "translate(-3px, -3px)",
        willChange: "transform, opacity",
      }}
    >
      {/* Ink contact dot with subtle glow */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--ink-orange, #e67e22)",
          boxShadow: "0 0 8px rgba(230, 126, 34, 0.8)",
        }}
      />
      {/* Tilted Stylus pen icon */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: 4,
          top: -20,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
          transform: "rotate(-15deg)",
          transformOrigin: "bottom left",
        }}
      >
        <path
          d="M3 21l3-1 11-11-2-2L4 18l-1 3z"
          fill="#334155"
          stroke="#fff"
          strokeWidth="0.8"
        />
        <path d="M15 7l2 2" stroke="#cbd5e1" strokeWidth="1" />
        <circle cx="3" cy="21" r="1.5" fill="#e67e22" />
      </svg>
    </div>
  );
}
