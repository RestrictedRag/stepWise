"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { newEntry, saveEntry, type Entry, type Mode } from "../../lib/history";
import { MODES, canSubmit, hrefFor } from "../../lib/modes";
import { useMic } from "../useMic";

type Img = NonNullable<Entry["image"]>;

export default function InputCard({ text, setText }: { text: string; setText: (fn: (p: string) => string) => void }) {
  const router = useRouter();
  const initial = useSearchParams()?.get("mode");
  const [mode, setMode] = useState<Mode>(MODES.some((m) => m.id === initial) ? (initial as Mode) : "solver");
  const [image, setImage] = useState<Img | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mic, micError, toggleMic } = useMic((t) => setText((p) => (p ? p + " " + t : t)));
  const ok = canSubmit(text, !!image);

  function submit() {
    if (!ok) return;
    const e = newEntry(mode, text.trim(), image ?? undefined);
    saveEntry(e);
    router.push(hrefFor(e));
  }

  function pick(f: File | undefined) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const [head, data] = String(r.result).split(",");
      setImage({ mediaType: head.slice(5, head.indexOf(";")), data });
    };
    r.readAsDataURL(f);
  }

  const btn = { width: 36, height: 36, borderRadius: 18, border: "none", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--muted)" } as const;

  return (
    <div>
      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,.06)", padding: 14 }}>
        {image && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8, padding: 4, border: "1px solid var(--line)", borderRadius: 8 }}>
            <img src={`data:${image.mediaType};base64,${image.data}`} alt="Upload" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
            <button aria-label="Remove image" onClick={() => setImage(null)} style={{ ...btn, width: 24, height: 24 }}>×</button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(() => e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything or upload a file"
          rows={3}
          style={{ width: "100%", border: "none", outline: "none", resize: "none", font: "inherit", fontSize: 16, color: "var(--text)", background: "transparent" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <button aria-label="Attach image" onClick={() => fileRef.current?.click()} style={btn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
          </button>
          <span style={{ flex: 1, fontSize: 12, color: "var(--muted)" }}>{micError || (text.length > 600 ? `${text.length}/600` : "")}</span>
          <button aria-label={mic === "rec" ? "Stop recording" : "Record"} onClick={toggleMic} disabled={mic === "busy"} style={{ ...btn, color: mic === "rec" ? "#d33" : "var(--muted)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0014 0M12 17v5" /></svg>
          </button>
          <button aria-label="Send" onClick={submit} disabled={!ok} style={{ ...btn, background: ok ? "var(--text)" : "var(--line)", color: "#fff", cursor: ok ? "pointer" : "default" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 14 }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            style={{ padding: "6px 14px", borderRadius: 999, fontSize: 14, cursor: "pointer", background: "var(--bg)", color: mode === m.id ? "var(--blue)" : "var(--text)", border: `1px solid ${mode === m.id ? "var(--blue)" : "var(--line)"}` }}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
