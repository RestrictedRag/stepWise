"use client";
import { useId, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { W, H, seedFrom, focusBox, type Shape as ShapeData, type Step, type Color, type Icon } from "../../lib/board";

const INTRO = 2.4; // title card: 1.5s write-on, short hold, 0.8s move up; step 0 starts after
const STROKE = 0.35, CHAR = 0.02; // seconds per stroke / per typed character

const ICON_PATHS: Record<Icon, string> = {
  crown: "M4 30 L8 10 L16 20 L20 6 L24 20 L32 10 L36 30 Z",
  bolt: "M23 2 L8 22 H19 L15 38 L32 16 H21 Z",
  star: "M20 3 L25 15 L38 15 L27 23 L31 36 L20 28 L9 36 L13 23 L2 15 L15 15 Z",
  check: "M6 21 L16 31 L35 8",
  cross: "M8 8 L32 32 M32 8 L8 32",
  heart: "M20 34 C4 22 4 10 12 8 C16 7 19 10 20 13 C21 10 24 7 28 8 C36 10 36 22 20 34 Z",
  speech: "M4 8 H36 V26 H18 L10 34 V26 H4 Z",
  fire: "M20 2 C26 12 34 16 30 28 C28 36 12 38 10 26 C9 20 14 16 16 10 C18 16 20 18 22 18 C20 12 18 8 20 2 Z",
};

const cost = (s: ShapeData) => (s.type === "text" ? s.text.length * CHAR : s.type === "label" ? (s.text.length + (s.note?.length ?? 0)) * CHAR : STROKE);
// Total seconds a step takes to draw, used by the player to pace autoplay.
export const stepSeconds = (step: Step, first = false) => (first ? INTRO : 0) + step.draw.reduce((t, s) => t + cost(s), 0);

function Typed({ x, y, text, size, color, delay, bold, rotate = 0, dur }: { x: number; y: number; text: string; size: number; color: Color; delay: number; bold?: boolean; rotate?: number; dur?: number }) {
  return (
    <text className="t" textAnchor="middle" x={x} y={y} fontSize={size} transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined} fontWeight={bold ? 700 : 400}
      style={{ fill: `var(--c-${color})`, animationDelay: `${delay}s`, animationDuration: `${dur ?? text.length * CHAR}s`, animationTimingFunction: `steps(${text.length})` }}>
      {text}
    </text>
  );
}

// Small filled dot where a stroke ends, fading in as the draw finishes (ink bleed).
function Bleed({ at, color, delay, done }: { at: [number, number]; color: Color; delay: number; done: boolean }) {
  return <motion.circle cx={at[0]} cy={at[1]} r={3} style={{ fill: `var(--c-${color})` }} initial={done ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + STROKE - 0.1, duration: 0.15 }} />;
}

// shortcut: end point = last coordinate pair in the path string (wrong if it ends in H/V), fine for model doodles; switch to getPointAtLength if dots land off the stroke
const pathEnd = (d: string): [number, number] => { const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number); return [n[n.length - 2], n[n.length - 1]]; };

function Shape({ s, delay, done }: { s: ShapeData; delay: number; done: boolean }) {
  const stroke = { stroke: `var(--c-${s.color})`, animationDelay: `${delay}s`, animationTimingFunction: "ease-in-out" };
  const p = { className: "s", pathLength: 1, style: stroke };
  const dot = (at: [number, number]) => <Bleed at={at} color={s.color} delay={delay} done={done} />;
  switch (s.type) {
    case "line": return <g><line {...p} x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]} />{dot(s.to)}</g>;
    case "highlight": {
      const [a, b] = s.from[0] <= s.to[0] ? [s.from, s.to] : [s.to, s.from]; // always sweeps left to right
      return <line {...p} className="s hl" style={{ ...stroke, mixBlendMode: "multiply" }} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
    }
    case "arrow": {
      const [x1, y1] = s.from, [x2, y2] = s.to, a = Math.atan2(y2 - y1, x2 - x1);
      const head = (d: number) => `${x2 - 18 * Math.cos(a + d)} ${y2 - 18 * Math.sin(a + d)}`;
      return <g><path {...p} d={`M${x1} ${y1} L${x2} ${y2} M${head(0.5)} L${x2} ${y2} L${head(-0.5)}`} />{dot(s.to)}</g>;
    }
    case "circle": return <g><circle {...p} cx={s.x} cy={s.y} r={s.r} />{dot([s.x + s.r, s.y])}</g>;
    case "ellipse": return <g><ellipse {...p} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} />{dot([s.x + s.rx, s.y])}</g>;
    case "rect": return <g><rect {...p} x={s.x} y={s.y} width={s.w} height={s.h} />{dot([s.x, s.y])}</g>;
    case "path": return <g><path {...p} d={s.d} />{dot(pathEnd(s.d))}</g>;
    case "icon": {
      const [ex, ey] = pathEnd(ICON_PATHS[s.name]);
      return <g><path {...p} d={ICON_PATHS[s.name]} transform={`translate(${s.x - 20} ${s.y - 20})`} />{dot([s.x - 20 + ex, s.y - 20 + ey])}</g>;
    }
    case "text": return <Typed x={s.x} y={s.y} text={s.text} size={s.size} color={s.color} delay={delay} />;
    case "label":
      return (
        <g>
          <Typed x={s.x} y={s.y} text={s.text} size={32} color={s.color} delay={delay} bold />
          {s.note && <Typed x={s.x} y={s.y + 30} text={s.note} size={22} color={s.color === "orange" ? "purple" : "orange"} rotate={-2} delay={delay + s.text.length * CHAR} />}
        </g>
      );
  }
}

// Draws steps[0..current]; only the current step animates, earlier ones appear finished.
// delays (optional) replaces the cumulative-cost delay of the current step's shapes, index-aligned with its draw list.
export default function Board({ steps, current, run, title, subtitle, delays }: { steps: Step[]; current: number; run: number; title: string; subtitle?: string | null; delays?: number[] }) {
  const wobble = `wob${useId().replace(/:/g, "")}`;
  const first = useRef(run).current;
  const lead = current === 0 && run === first ? INTRO : 0; // title card plays only on first mount
  const box = steps[current] ? focusBox(steps[current].draw) : [0, 0, W, H];
  return (
    <motion.svg className="board" initial={{ viewBox: `0 0 ${W} ${H}` }} animate={{ viewBox: box.join(" ") }}
      transition={{ duration: 1.2, ease: "easeInOut", delay: lead }} role="img" aria-label={`Whiteboard: ${title}`}>
      <defs>
        <filter id={wobble} filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <feTurbulence type="fractalNoise" baseFrequency={0.02} numOctaves={2} seed={seedFrom(title)} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2} />
        </filter>
      </defs>
      {steps.slice(0, current + 1).map((step, i) => {
        let t = i === current ? lead : 0;
        const ink: ReactNode[] = [], words: ReactNode[] = []; // wobble the strokes once per step, never the text
        step.draw.forEach((s, j) => {
          const delay = i === current && delays?.[j] !== undefined ? delays[j] + lead : t;
          t += cost(s);
          (s.type === "text" || s.type === "label" ? words : ink).push(<Shape key={j} s={s} delay={delay} done={i < current} />);
        });
        return (
          <g key={i === current ? `${i}-${run}` : i} className={i < current ? "done" : undefined}>
            <g filter={`url(#${wobble})`}>{ink}</g>
            {words}
          </g>
        );
      })}
      {lead > 0 && (
        <motion.g initial={{ y: 0, scale: 1 }} animate={{ y: -300, scale: 0.4 }} transition={{ delay: INTRO - 0.8, duration: 0.8, ease: "easeInOut" }}
          style={{ pointerEvents: "none", transformBox: "view-box", transformOrigin: `${W / 2}px ${H / 2}px` }}>
          <Typed x={W / 2} y={H / 2 - 10} text={title} size={64} color="ink" delay={0} dur={subtitle ? 1 : 1.5} bold />
          {subtitle && <Typed x={W / 2} y={H / 2 + 50} text={subtitle} size={34} color="purple" delay={1} dur={0.5} />}
        </motion.g>
      )}
    </motion.svg>
  );
}
