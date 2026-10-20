"use client";
import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { encodeWav } from "../../lib/wav";
import { mathText } from "../../lib/mathtext";
import "katex/dist/katex.min.css";

const EXAMPLES = ["Solve 3x + 5 = 17", "Why is the sky blue?", "A train travels 120 km in 1.5 h. What is its speed?"];

export default function Solver() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [mic, setMic] = useState<"idle" | "rec" | "busy">("idle");
  const [micError, setMicError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);

  // Record → decode → 16 kHz mono WAV → /api/listen; the transcript lands in the box, the user still presses Solve.
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
      setTimeout(() => rec.state === "recording" && rec.stop(), 30_000); // Gnani caps clips at 30–60 s
    } catch {
      setMicError("Microphone is not available.");
    }
  }

  function pickImage(file?: File) {
    if (!file) return setImage(null);
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onPaste(e: ClipboardEvent) {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
    if (file) pickImage(file);
  }

  async function solve(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAnswer("");
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, image }),
      });
      if (!res.ok) {
        setAnswer((await res.json()).error || "Something went wrong.");
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((a) => a + decoder.decode(value, { stream: true }));
      }
    } catch {
      setAnswer("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setText("");
    setImage(null);
    setAnswer("");
  }

  return (
    <form className="solver" onSubmit={solve}>
      <div className="panel">
        <label htmlFor="q" className="sr-only">Your question</label>
        <textarea
          id="q"
          rows={5}
          placeholder="Type a question, or paste a photo of it"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
        />
        {image && <img className="preview" src={image} alt="Attached question" />}
        {micError && <p role="alert">{micError}</p>}
        <div className="row">
          <div className="toolbar-start">
            <label className="btn ghost">
              Add photo
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            <button type="button" className="btn ghost" aria-pressed={mic === "rec"} disabled={mic === "busy"} onClick={toggleMic}>
              {mic === "rec" ? "Stop" : mic === "busy" ? "Listening…" : "Speak"}
            </button>
            <button type="button" className="btn ghost" onClick={reset}>New question</button>
          </div>
          <button type="submit" className="btn" disabled={busy || (!text.trim() && !image)}>
            {busy ? "Solving…" : <>Solve <span className="arr" aria-hidden="true">→</span></>}
          </button>
        </div>
      </div>
      {!text && !answer && (
        <div className="chips" aria-label="Examples">
          {EXAMPLES.map((ex) => <button type="button" key={ex} className="chip" onClick={() => setText(ex)}>{ex}</button>)}
        </div>
      )}
      {answer && (
        <div className="answer" aria-live="polite">
          {answer.split(/\n\s*\n/).filter((b) => b.trim()).map((b, n) => {
            const final = /^\s*\**Answer:/i.test(b);
            return (
              <p key={n} className={final ? "block final" : "block"}>
                {final ? <>Answer: <mark dangerouslySetInnerHTML={{ __html: mathText(b.replace(/^\s*\**Answer:\**\s*/i, "")) }} /></> : <span dangerouslySetInnerHTML={{ __html: mathText(b) }} />}
              </p>
            );
          })}
        </div>
      )}
    </form>
  );
}
