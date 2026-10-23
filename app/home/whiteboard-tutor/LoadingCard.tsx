"use client";

import { useEffect, useState } from "react";

// Copy is invented: the reference video's text was not available (see ledger Ruling).
const TIPS = [
  "Ask a question any time — the tutor pauses and draws the answer.",
  "Drag to pan the board and use zoom to look closer.",
  "Change the speed in the bottom bar to match your pace.",
];
const STEPS = ["Reading your topic", "Planning the lesson", "Writing the steps", "Drawing the board", "Getting ready to teach"];

export default function LoadingCard() {
  const [tip, setTip] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 4000);
    const s = setInterval(() => setStep((n) => Math.min(n + 1, STEPS.length - 1)), 2500);
    return () => { clearInterval(t); clearInterval(s); };
  }, []);

  return (
    <main style={{ display: "grid", placeItems: "center", padding: "48px 16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", width: "100%", maxWidth: 820, border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", background: "var(--bg)" }}>
        <div style={{ flex: "1 1 40%", minWidth: 240, background: "var(--blue)", color: "#fff", padding: 32, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 260 }}>
          <strong>Tip</strong>
          <p style={{ fontSize: 18, lineHeight: 1.5 }} aria-live="polite">{TIPS[tip]}</p>
          <div style={{ display: "flex", gap: 6 }}>
            {TIPS.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === tip ? "#fff" : "rgba(255,255,255,0.4)" }} />)}
          </div>
        </div>
        <div style={{ flex: "1 1 60%", minWidth: 240, padding: 32 }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Preparing your lesson</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} style={{ display: "flex", gap: 10, alignItems: "center", margin: "12px 0", color: i <= step ? "var(--text)" : "var(--muted)" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, background: i < step ? "var(--blue)" : "transparent", color: "#fff", border: i < step ? "none" : "1px solid var(--line)" }}>{i < step ? "✓" : ""}</span>
                {s}{i === step && "…"}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
