// Procedural Deterministic Hand-Drawn Sketchy Geometry Engine
// Transforms clean Euclidean primitives into organic human whiteboard marker strokes.

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) % 2147483647;
  if (s === 0) s = 123456789;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function sketchLine(x1: number, y1: number, x2: number, y2: number, seed = 0): string {
  const rng = seededRandom(seed ^ (Math.round(x1 * 31) + Math.round(y1 * 17)));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;

  const nx = -dy / len;
  const ny = dx / len;
  const wobble = Math.min(3.5, len * 0.02);
  const w1 = (rng() - 0.5) * wobble;
  const w2 = (rng() - 0.5) * wobble;

  const p1x = Math.round(x1 + dx * 0.33 + nx * w1);
  const p1y = Math.round(y1 + dy * 0.33 + ny * w1);
  const p2x = Math.round(x1 + dx * 0.67 + nx * w2);
  const p2y = Math.round(y1 + dy * 0.67 + ny * w2);

  return `M ${x1} ${y1} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${x2} ${y2}`;
}

export function sketchRect(x: number, y: number, w: number, h: number, seed = 0): string {
  const rng = seededRandom(seed ^ (Math.round(x * 19) + Math.round(y * 23) + Math.round(w * 7)));

  const tlX = x + (rng() - 0.5) * 1.5;
  const tlY = y + (rng() - 0.5) * 1.5;
  const trX = x + w + (rng() - 0.5) * 1.5;
  const trY = y + (rng() - 0.5) * 1.5;
  const brX = x + w + (rng() - 0.5) * 1.5;
  const brY = y + h + (rng() - 0.5) * 1.5;
  const blX = x + (rng() - 0.5) * 1.5;
  const blY = y + h + (rng() - 0.5) * 1.5;

  const topMidY = y + (rng() - 0.5) * 2;
  const rightMidX = x + w + (rng() - 0.5) * 2;
  const bottomMidY = y + h + (rng() - 0.5) * 2;
  const leftMidX = x + (rng() - 0.5) * 2;

  return (
    `M ${Math.round(tlX)} ${Math.round(tlY)} ` +
    `Q ${Math.round((tlX + trX) / 2)} ${Math.round(topMidY)} ${Math.round(trX)} ${Math.round(trY)} ` +
    `Q ${Math.round(rightMidX)} ${Math.round((trY + brY) / 2)} ${Math.round(brX)} ${Math.round(brY)} ` +
    `Q ${Math.round((brX + blX) / 2)} ${Math.round(bottomMidY)} ${Math.round(blX)} ${Math.round(blY)} ` +
    `Q ${Math.round(leftMidX)} ${Math.round((blY + tlY) / 2)} ${Math.round(tlX + 2)} ${Math.round(tlY + 1)}`
  );
}

export function sketchEllipse(cx: number, cy: number, rx: number, ry: number, seed = 0): string {
  const rng = seededRandom(seed ^ (Math.round(cx * 13) + Math.round(cy * 29) + Math.round(rx * 17)));
  const d = 1.05; // 5% overlap for authentic hand-drawn whiteboard marker feel

  const numSteps = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i <= numSteps; i++) {
    const angle = (i / numSteps) * Math.PI * 2 * d - Math.PI / 2;
    const wobbleR = 1 + (rng() - 0.5) * 0.04;
    const px = Math.round(cx + rx * Math.cos(angle) * wobbleR);
    const py = Math.round(cy + ry * Math.sin(angle) * wobbleR);
    pts.push([px, py]);
  }

  let path = `M ${pts[0][0]} ${pts[0][1]} `;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    path += `C ${Math.round(cp1x)} ${Math.round(cp1y)}, ${Math.round(cp2x)} ${Math.round(cp2y)}, ${p2[0]} ${p2[1]} `;
  }

  return path;
}

export function sketchArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed = 0
): { shaftPath: string; headPath: string } {
  const rng = seededRandom(seed ^ (Math.round(x1 * 41) + Math.round(y2 * 37)));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);

  const nx = -dy / len;
  const ny = dx / len;
  const bow = (rng() - 0.5) * Math.min(8, len * 0.04);
  const mx = (x1 + x2) / 2 + nx * bow;
  const my = (y1 + y2) / 2 + ny * bow;

  const shaftPath = `M ${x1} ${y1} Q ${Math.round(mx)} ${Math.round(my)} ${x2} ${y2}`;

  const headLen = Math.min(22, Math.max(14, len * 0.15));
  const headAngle = 0.48 + (rng() - 0.5) * 0.08;

  const h1x = Math.round(x2 - headLen * Math.cos(a - headAngle));
  const h1y = Math.round(y2 - headLen * Math.sin(a - headAngle));
  const h2x = Math.round(x2 - headLen * Math.cos(a + headAngle));
  const h2y = Math.round(y2 - headLen * Math.sin(a + headAngle));

  const headPath = `M ${h1x} ${h1y} L ${x2} ${y2} L ${h2x} ${h2y}`;

  return { shaftPath, headPath };
}

