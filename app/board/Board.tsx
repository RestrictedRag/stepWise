import { W, H, type Shape as ShapeData, type Step, type Color, type Icon } from "../../lib/board";

const STROKE = 0.35, CHAR = 0.02; // seconds per stroke / per typed character

const ICON_PATHS: Record<Icon, string> = {
  crown: "M4 30 L8 10 L16 20 L20 6 L24 20 L32 10 L36 30 Z",
  bolt: "M23 2 L8 22 H19 L15 38 L32 16 H21 Z",
  star: "M20 3 L25 15 L38 15 L27 23 L31 36 L20 28 L9 36 L13 23 L2 15 L15 15 Z",
  check: "M6 21 L16 31 L35 8",
  cross: "M8 8 L32 32 M32 8 L8 32",
};

const cost = (s: ShapeData) => (s.type === "text" ? s.text.length * CHAR : s.type === "label" ? (s.text.length + (s.note?.length ?? 0)) * CHAR : STROKE);
// Total seconds a step takes to draw, used by the player to pace autoplay.
export const stepSeconds = (step: Step) => step.draw.reduce((t, s) => t + cost(s), 0);

function Typed({ x, y, text, size, color, delay, bold }: { x: number; y: number; text: string; size: number; color: Color; delay: number; bold?: boolean }) {
  return (
    <text className="t" x={x} y={y} fontSize={size} fontWeight={bold ? 700 : 400}
      style={{ fill: `var(--c-${color})`, animationDelay: `${delay}s`, animationDuration: `${text.length * CHAR}s`, animationTimingFunction: `steps(${text.length})` }}>
      {text}
    </text>
  );
}

function Shape({ s, delay }: { s: ShapeData; delay: number }) {
  const stroke = { stroke: `var(--c-${s.color})`, animationDelay: `${delay}s` };
  const p = { className: "s", pathLength: 1, style: stroke };
  switch (s.type) {
    case "line": return <line {...p} x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]} />;
    case "highlight": return <line {...p} className="s hl" x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]} />;
    case "arrow": {
      const [x1, y1] = s.from, [x2, y2] = s.to, a = Math.atan2(y2 - y1, x2 - x1);
      const head = (d: number) => `${x2 - 18 * Math.cos(a + d)} ${y2 - 18 * Math.sin(a + d)}`;
      return <path {...p} d={`M${x1} ${y1} L${x2} ${y2} M${head(0.5)} L${x2} ${y2} L${head(-0.5)}`} />;
    }
    case "circle": return <circle {...p} cx={s.x} cy={s.y} r={s.r} />;
    case "ellipse": return <ellipse {...p} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} />;
    case "rect": return <rect {...p} x={s.x} y={s.y} width={s.w} height={s.h} />;
    case "path": return <path {...p} d={s.d} />;
    case "icon": return <path {...p} d={ICON_PATHS[s.name]} transform={`translate(${s.x - 20} ${s.y - 20})`} />;
    case "text": return <Typed x={s.x} y={s.y} text={s.text} size={s.size} color={s.color} delay={delay} />;
    case "label":
      return (
        <g>
          <Typed x={s.x} y={s.y} text={s.text} size={32} color={s.color} delay={delay} bold />
          {s.note && <Typed x={s.x} y={s.y + 30} text={s.note} size={24} color="ink" delay={delay + s.text.length * CHAR} />}
        </g>
      );
  }
}

// Draws steps[0..current]; only the current step animates, earlier ones appear finished.
export default function Board({ steps, current, run, title }: { steps: Step[]; current: number; run: number; title: string }) {
  return (
    <svg className="board" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Whiteboard: ${title}`}>
      {steps.slice(0, current + 1).map((step, i) => {
        let t = 0;
        return (
          <g key={i === current ? `${i}-${run}` : i} className={i < current ? "done" : undefined}>
            {step.draw.map((s, j) => {
              const delay = t;
              t += cost(s);
              return <Shape key={j} s={s} delay={delay} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}
