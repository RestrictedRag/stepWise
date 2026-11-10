/**
 * Sub-frame clock interpolator for 60fps animations tied to audio master time.
 */

export function interpolateClock(
  lastAudioMs: number,
  lastTickT: number,
  nowT: number,
  speed: number = 1.0,
  maxDriftMs: number = 350
): number {
  if (nowT <= lastTickT) return lastAudioMs;
  const elapsed = (nowT - lastTickT) * Math.max(0.25, speed);
  const clampedElapsed = Math.min(maxDriftMs, elapsed);
  return lastAudioMs + clampedElapsed;
}

