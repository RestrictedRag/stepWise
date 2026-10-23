"use client";

import { Suspense, useState } from "react";
import InputCard from "./home/InputCard";

// shortcut: stand-in examples, video frames unchecked; swap for the video's text when verified
const EXAMPLES: Record<string, string[]> = {
  Study: ["Explain photosynthesis step by step", "Solve 2x + 5 = 17", "What caused World War I?"],
  "Exam Prep": ["Quiz me on cell biology", "Key formulas for kinematics", "Practice problems on derivatives"],
  Writing: ["Outline an essay on climate change", "Improve this thesis statement", "Explain how to cite in APA"],
};

export default function Home() {
  const [text, setText] = useState("");
  const [tab, setTab] = useState("Study");

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 16px" }}>
      <h1 style={{ textAlign: "center", fontSize: 32, fontWeight: 700, margin: "0 0 24px" }}>What do you want to learn today?</h1>
      <div role="tablist" style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 16 }}>
        {Object.keys(EXAMPLES).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 15, padding: "6px 2px", color: tab === t ? "var(--text)" : "var(--muted)", fontWeight: tab === t ? 600 : 400, borderBottom: `2px solid ${tab === t ? "var(--text)" : "transparent"}` }}
          >
            {t}
          </button>
        ))}
      </div>
      <Suspense>
        <InputCard text={text} setText={setText} />
      </Suspense>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 28 }}>
        {EXAMPLES[tab].map((ex) => (
          <button key={ex} onClick={() => setText(() => ex)} className="nav-item" style={{ textAlign: "left", padding: 14, borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)", fontSize: 14, cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
