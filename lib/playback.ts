export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// unknown speed → indexOf -1 → SPEEDS[0]
export const nextSpeed = (s: number) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length];

export const spliceSteps = <T,>(a: T[], at: number, add: T[]) => [...a.slice(0, at + 1), ...add, ...a.slice(at + 1)];

export const fallbackMs = (say: string, speed: number) => (say.length * 60) / speed;

export const speedLabel = (s: number) => (Number.isInteger(s) ? s.toFixed(1) : String(s)) + "x Speed";
