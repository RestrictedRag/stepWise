import type { Shape } from "../../../lib/board";
import { mathText } from "../../../lib/mathtext";
import { sketchLine, sketchRect, sketchEllipse, sketchArrow } from "../../../lib/sketch";

const ICON_PATHS = {
  crown: "M3 18h18M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  star: "M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z",
  check: "M4 12l5 5L20 6",
  cross: "M5 5l14 14M19 5L5 19",
  heart: "M12 21C5 15 2 12 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-3 7-10 13z",
  speech: "M4 4h16v11H9l-5 5z",
  fire: "M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-8z",
};

const MATH = /\$\$|\\\(|\\\[/;

export const isStroke = (s: Shape) => s.type !== "text" && s.type !== "label" && s.type !== "icon";

export function renderShape(s: Shape) {
  const ink = `var(--ink-${s.color})`;
  const st = { stroke: ink, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", fill: "none", pathLength: 1 } as const;
  switch (s.type) {
    case "line": {
      const d = sketchLine(s.from[0], s.from[1], s.to[0], s.to[1]);
      return <path d={d} {...st} />;
    }
    case "highlight": {
      const d = sketchLine(s.from[0], s.from[1], s.to[0], s.to[1]);
      return <path d={d} {...st} strokeWidth={24} opacity={0.3} />;
    }
    case "arrow": {
      const [x1, y1] = s.from, [x2, y2] = s.to;
      const { shaftPath, headPath } = sketchArrow(x1, y1, x2, y2);
      return (
        <g>
          <path d={shaftPath} {...st} />
          <path d={headPath} {...st} />
        </g>
      );
    }
    case "circle": {
      const d = sketchEllipse(s.x, s.y, s.r, s.r);
      return <path d={d} {...st} />;
    }
    case "ellipse": {
      const d = sketchEllipse(s.x, s.y, s.rx, s.ry);
      return <path d={d} {...st} />;
    }
    case "rect": {
      const d = sketchRect(s.x, s.y, s.w, s.h);
      return <path d={d} {...st} />;
    }
    case "path":
      return <path d={s.d} {...st} />;
    case "text":
      if (MATH.test(s.text))
        return (
          <foreignObject x={s.x - 300} y={s.y - s.size} width={600} height={s.size * 2}>
            <div className="font-board" style={{ color: ink, fontSize: s.size, textAlign: "center" }} dangerouslySetInnerHTML={{ __html: mathText(s.text) }} />
          </foreignObject>
        );
      return <text x={s.x} y={s.y} className="font-board" textAnchor="middle" fontSize={s.size} fill={ink}>{s.text}</text>;
    case "label":
      return (
        <g className="font-board" textAnchor="middle">
          <text x={s.x} y={s.y} fontSize={24} fill={ink}>{s.text}</text>
          {s.note && <text x={s.x} y={s.y + 22} fontSize={16} fill="var(--muted)">{s.note}</text>}
        </g>
      );
    case "icon":
      return (
        <g transform={`translate(${s.x - 20},${s.y - 20}) scale(${40 / 24})`}>
          <path d={ICON_PATHS[s.name]} stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      );
  }
}
