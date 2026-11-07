"use client";

import React from "react";
import type { Color } from "../../../lib/board";

interface Props {
  x: number;
  y: number;
  active: boolean;
  color?: Color;
}

export default function VirtualStylus({ x, y, active, color = "ink" }: Props) {
  const inkColor = `var(--ink-${color}, #1f7a4d)`;

  return (
    <g
      id="virtual-stylus"
      transform={`translate(${x}, ${y})`}
      style={{
        pointerEvents: "none",
        opacity: active ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      {/* Contact ink glow */}
      <circle cx={0} cy={0} r={5} fill={inkColor} opacity={0.65} />
      <circle cx={0} cy={0} r={2.5} fill="#ffffff" />

      {/* Stylus body tilted at 45 degrees */}
      <g transform="translate(1, -28) rotate(32)">
        {/* Shadow */}
        <rect x={-3} y={0} width={6} height={36} rx={3} fill="#000000" opacity={0.15} transform="translate(4, 4)" />

        {/* Pen barrel */}
        <rect x={-3.5} y={0} width={7} height={36} rx={3.5} fill="#2c2d30" stroke="#18181b" strokeWidth={0.75} />

        {/* Grip accent */}
        <rect x={-3.5} y={22} width={7} height={10} fill={inkColor} rx={1} />

        {/* Pen Nib */}
        <polygon points="-2.5,36 2.5,36 0,42" fill="#d4d4d8" />
        <polygon points="-1,40 1,40 0,42" fill={inkColor} />
      </g>
    </g>
  );
}
