// One narration clip per step. Clip 0 is fetched alone first so step 0 isn't slowed by the rest.
export function loadClips(says: string[], speak: (text: string) => Promise<Blob | null>, stored?: (Blob | null)[]): Promise<Blob | null>[] {
  if (!says.length) return [];
  if (stored) return stored.map((b) => Promise.resolve(b));
  const one = (t: string) => speak(t).catch(() => null);
  const ps: Promise<Blob | null>[] = [];
  says.forEach((t, i) => ps.push(i === 0 ? one(t) : ps[i - 1].then(() => one(t)))); // sequential: parallel calls 502 upstream
  return ps;
}
