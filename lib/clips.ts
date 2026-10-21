// One narration clip per step. Clip 0 is fetched alone first so step 0 isn't slowed by the rest.
export function loadClips(says: string[], speak: (text: string) => Promise<Blob | null>, stored?: (Blob | null)[]): Promise<Blob | null>[] {
  if (stored) return stored.map((b) => Promise.resolve(b));
  const one = (t: string) => speak(t).catch(() => null);
  const first = one(says[0]);
  return says.map((t, i) => (i === 0 ? first : first.then(() => one(t))));
}
