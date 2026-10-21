"use client";
import { useRef, useState, type FormEvent } from "react";
import { encodeWav } from "../../lib/wav";
import { LANGS } from "../../lib/validate";

export type Lang = (typeof LANGS)[number];
const STYLES = [["Normal", ""], ["Like I'm 5", "Like I'm 5"], ["Gossip", "Gossip"], ["Sports commentator", "Sports commentator"], ["Exam-crisp", "Exam-crisp"]] as const;
const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "Hindi", kn: "Kannada", ta: "Tamil" };

type Props = { busy: boolean; style: string; onStyle: (s: string) => void; lang: Lang; onLang: (l: Lang) => void; onAsk: (text: string) => void; quoteMode: boolean; error?: string };

export default function AskBar({ busy, style, onStyle, lang, onLang, onAsk, quoteMode, error }: Props) {
  const [text, setText] = useState("");
  const [mic, setMic] = useState<"idle" | "rec" | "busy">("idle");
  const [micError, setMicError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);

  // Same record -> 16 kHz mono WAV -> /api/listen flow as Solve; the transcript lands in the box, the user still presses Ask.
  async function toggleMic() {
    if (recorder.current) return recorder.current.stop();
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        setMic("busy");
        const ctx = new AudioContext();
        try {
          const decoded = await ctx.decodeAudioData(await new Blob(chunks).arrayBuffer());
          const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
          const src = off.createBufferSource();
          src.buffer = decoded;
          src.connect(off.destination);
          src.start();
          const body = new FormData();
          body.append("audio", new Blob([encodeWav((await off.startRendering()).getChannelData(0), 16000)], { type: "audio/wav" }));
          const res = await fetch("/api/listen", { method: "POST", body });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          if (json.text) setText((t) => (t.trim() ? t.trimEnd() + " " : "") + json.text);
        } catch (e) {
          setMicError(e instanceof Error && e.message ? e.message : "Could not hear that. Try again.");
        } finally {
          ctx.close();
          setMic("idle");
        }
      };
      rec.start();
      recorder.current = rec;
      setMic("rec");
      setTimeout(() => rec.state === "recording" && rec.stop(), 30_000); // Gnani caps clips at 30-60 s
    } catch {
      setMicError("Microphone is not available.");
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); if (text.trim()) onAsk(text.trim()); };
  const preset = STYLES.some(([, v]) => v === style);

  return (
    <form className="solver ask-bar" onSubmit={submit}>
      <div className="chips" role="group" aria-label="Narration style">
        {STYLES.map(([label, v]) => (
          <button key={label} type="button" className="btn ghost" aria-pressed={style === v} onClick={() => onStyle(v)}>{label}</button>
        ))}
      </div>
      <div className="panel">
        <label htmlFor="ask" className="sr-only">{quoteMode ? "The question's line" : "Which question?"}</label>
        <input id="ask" placeholder={quoteMode ? "Type or paste the question's line" : "Which question? e.g. Q3 or the triangle problem"} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <label>Own style <input aria-label="Custom style" placeholder="e.g. pirate" maxLength={80} value={preset ? "" : style} onChange={(e) => onStyle(e.target.value)} /></label>
          <label>Language <select value={lang} onChange={(e) => onLang(e.target.value as Lang)}>{LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}</select></label>
          <button type="button" className="btn ghost" aria-pressed={mic === "rec"} disabled={mic === "busy"} onClick={toggleMic}>
            {mic === "rec" ? "Stop" : mic === "busy" ? "Listening..." : "Speak"}
          </button>
          <button type="submit" className="btn" disabled={busy || !text.trim()}>{busy ? "Working..." : "Ask"}</button>
        </div>
      </div>
      {(error || micError) && <p role="alert">{error || micError}</p>}
    </form>
  );
}
