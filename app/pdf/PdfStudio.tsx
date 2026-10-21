"use client";
import { useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import Player from "../board/Player";
import PdfPane from "./PdfPane";
import AskBar, { type Lang } from "./AskBar";
import type { BoardScript } from "../../lib/board";

type Box = [number, number, number, number];
type Doubt = { question: string; script: BoardScript | null };

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function failure(res: Response) {
  const j = await res.json().catch(() => null);
  return typeof j?.error === "string" ? j.error : "Something went wrong. Try again.";
}

export default function PdfStudio() {
  const [file, setFile] = useState<ArrayBuffer | null>(null);
  const [page, setPage] = useState(1);
  const [bbox, setBbox] = useState<Box | null>(null);
  const [script, setScript] = useState<BoardScript | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quoteMode, setQuoteMode] = useState(false);
  const [layout, setLayout] = useState<"reading" | "asking">("reading");
  const [step, setStep] = useState(0);
  const [doubt, setDoubt] = useState<Doubt | null>(null);
  const [doubtBusy, setDoubtBusy] = useState(false);
  const [doubtText, setDoubtText] = useState("");
  const [clips, setClips] = useState<(Blob | null)[]>();
  const [style, setStyle] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [question, setQuestion] = useState("");
  const [ready, setReady] = useState(false);
  const rid = useRef(0); // request id: a response whose id is stale is ignored
  const renderRef = useRef<(() => Promise<string>) | null>(null);

  function cancel() { rid.current++; setBusy(false); setDoubtBusy(false); }

  async function upload(f: File | undefined) {
    if (!f) return;
    cancel();
    setFile(await f.arrayBuffer());
    setPage(1); setBbox(null); setScript(null); setClips(undefined); setDoubt(null);
    setQuoteMode(false); setError(""); setLayout("reading");
  }

  function changePage(n: number) {
    cancel();
    setPage(n); setBbox(null); setQuoteMode(false); setError("");
  }

  async function ask(text: string) {
    cancel(); const id = rid.current;
    setBusy(true); setError("");
    try {
      let q = text;
      if (!quoteMode) {
        const res = await post("/api/locate", { image: await renderRef.current!(), ask: text });
        if (id !== rid.current) return;
        if (!res.ok) return setError(await failure(res));
        const located = await res.json();
        if (id !== rid.current) return;
        if (located.missing) {
          setQuoteMode(true);
          return setError("Couldn't find that on this page — type or paste the question's line.");
        }
        setBbox(located.bbox);
        q = located.question;
      }
      const res = await post("/api/lesson", { topic: q, style, lang, fromQuestion: true });
      if (id !== rid.current) return;
      if (!res.ok) return setError(await failure(res));
      const { script: s } = await res.json();
      if (id !== rid.current) return;
      setQuestion(q); setScript(s); setClips(undefined); setStep(0); setDoubt(null); setQuoteMode(false);
      setLayout("asking");
    } catch {
      if (id === rid.current) setError("Something went wrong. Try again.");
    } finally {
      if (id === rid.current) setBusy(false);
    }
  }

  async function askDoubt(e: FormEvent) {
    e.preventDefault();
    if (!script || !doubt || !doubtText.trim()) return;
    const typed = doubtText.trim();
    const prev = doubt.script ? doubt.question : undefined; // asking again replaces the open doubt; its question is context
    rid.current++; const id = rid.current;
    setBusy(false); setDoubtBusy(true); setError("");
    try {
      const res = await post("/api/lesson", {
        topic: question, style, lang,
        doubt: { question: typed, say: script.steps[step].say, titles: script.steps.slice(0, step + 1).map((s) => s.say.slice(0, 80)), ...(prev && { prev }) },
      });
      if (id !== rid.current) return;
      if (!res.ok) return setError(await failure(res));
      const { script: s } = await res.json();
      if (id !== rid.current) return;
      setDoubt({ question: typed, script: s }); setDoubtText(""); // only on success, so a failed re-ask keeps the previous answer
    } catch {
      if (id === rid.current) setError("Something went wrong. Try again.");
    } finally {
      if (id === rid.current) setDoubtBusy(false);
    }
  }

  const asking = layout === "asking";
  return (
    <div className="pdf-studio">
      <label className="btn ghost pdf-upload">
        {file ? "Choose another PDF" : "Upload a PDF"}
        <input type="file" accept="application/pdf" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {file && (
        <>
          <AskBar busy={busy || !ready} style={style} onStyle={setStyle} lang={lang} onLang={setLang} onAsk={ask} quoteMode={quoteMode} error={error} />
          <div className="pdf-cols">
            <motion.div className="pdf-col" initial={false} animate={{ flexBasis: asking ? "30%" : "66%" }} transition={{ duration: 0.5, ease: "easeInOut" }}>
              <PdfPane file={file} page={page} onPage={changePage} bbox={bbox} renderRef={renderRef} onReady={setReady} />
            </motion.div>
            <motion.div className="pdf-col" initial={false} animate={{ flexBasis: asking ? "70%" : "34%" }} transition={{ duration: 0.5, ease: "easeInOut" }}>
              {script ? (
                <>
                  <div style={{ opacity: doubt ? 0.4 : 1 }}>
                    <Player script={script} paused={doubt !== null} onStep={setStep} clips={clips} onClips={setClips} />
                  </div>
                  {!doubt && <button type="button" className="btn ghost" onClick={() => setDoubt({ question: "", script: null })}>Doubt?</button>}
                  {doubt && (
                    <div className="pdf-drawer">
                      <form className="row" onSubmit={askDoubt}>
                        <label htmlFor="doubt" className="sr-only">Your doubt</label>
                        <input id="doubt" placeholder="What is confusing here?" maxLength={600} value={doubtText} onChange={(e) => setDoubtText(e.target.value)} />
                        <button type="submit" className="btn" disabled={doubtBusy || !doubtText.trim()}>{doubtBusy ? "Working..." : "Ask"}</button>
                        <button type="button" className="btn ghost" onClick={() => { cancel(); setDoubt(null); setDoubtText(""); }}>Close</button>
                      </form>
                      {doubt.script && <Player key={doubt.question} script={doubt.script} autoplay />}
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">Ask about a question and its lesson shows up here.</p>
              )}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
