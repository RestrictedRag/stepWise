"use client";
import { useRef, useState } from "react";
import { encodeWav } from "../lib/wav";

// Record → decode → 16 kHz mono WAV → /api/listen; the transcript goes to onText, the caller decides what to do with it.
export function useMic(onText: (text: string) => void) {
  const [mic, setMic] = useState<"idle" | "rec" | "busy">("idle");
  const [micError, setMicError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const live = useRef(onText); live.current = onText;

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
          if (json.text) live.current(json.text);
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

  return { mic, micError, toggleMic };
}
