"use client";

import { useState } from "react";

type Props = { open: boolean; onSubmit: (stars: number) => void; onClose: () => void };

export default function EndModal({ open, onSubmit, onClose }: Props) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  if (!open) return null;
  const lit = hover || stars;

  return (
    <div role="dialog" aria-modal aria-label="End lesson" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", color: "var(--text)", borderRadius: 12, padding: 24, width: 320, textAlign: "center" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>How was this session?</h2>
        <div onMouseLeave={() => setHover(0)} style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => setStars(n)}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 28, color: n <= lit ? "#f5b301" : "var(--line)" }}>★</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={onClose} style={{ border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Cancel</button>
          <button disabled={!stars} onClick={() => onSubmit(stars)}
            style={{ border: "none", background: stars ? "var(--text)" : "var(--line)", color: "var(--bg)", borderRadius: 8, padding: "8px 16px", cursor: stars ? "pointer" : "default" }}>Submit</button>
        </div>
      </div>
    </div>
  );
}
