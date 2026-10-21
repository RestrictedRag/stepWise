"use client";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { renderScale } from "../../lib/pdfrender";

type Props = {
  file: ArrayBuffer; page: number; onPage: (n: number) => void;
  bbox: [number, number, number, number] | null;
  renderRef: MutableRefObject<(() => Promise<string>) | null>;
  onReady: (ready: boolean) => void;
  saved: { id: string; label: string }[]; onOpen: (id: string) => void;
};

export default function PdfPane({ file, page, onPage, bbox, renderRef, onReady, saved, onOpen }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const doc = useRef<any>(null);
  const done = useRef<Promise<void>>(Promise.resolve()); // never rejects
  const ok = useRef(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let dead = false;
    let loading: { destroy: () => Promise<void> } | undefined;
    setError(""); setCount(0); ok.current = false; onReady(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ data: file.slice(0) }); // slice: pdfjs transfers the buffer to its worker
        loading = task;
        const d = await task.promise;
        if (dead) return;
        doc.current = d;
        setCount(d.numPages);
      } catch {
        if (!dead) setError("Could not open that PDF.");
      }
    })();
    return () => { dead = true; loading?.destroy(); doc.current = null; };
  }, [file]);

  useEffect(() => {
    if (!count) return;
    let task: { promise: Promise<void>; cancel: () => void } | undefined;
    let dead = false;
    const prev = done.current;
    done.current = (async () => {
      await prev; // the previous render must release the canvas before we reuse it
      if (dead) return;
      try {
        const p = await doc.current.getPage(Math.min(Math.max(page, 1), count));
        if (dead) return;
        const vp = p.getViewport({ scale: renderScale(p.getViewport({ scale: 1 }).width) });
        const c = canvas.current!;
        c.width = vp.width; c.height = vp.height;
        task = p.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp });
        await task!.promise;
        ok.current = true; onReady(true);
      } catch { /* a cancelled render rejects; the next page's render takes over */ }
    })();
    return () => { dead = true; task?.cancel(); };
  }, [count, page]);

  useEffect(() => {
    renderRef.current = async () => {
      await done.current;
      if (!ok.current) throw new Error("page not rendered"); // never send a blank canvas to /api/locate
      return canvas.current!.toDataURL("image/jpeg", 0.85);
    };
    return () => { renderRef.current = null; };
  }, [renderRef]);

  if (error) return <p role="alert">{error}</p>;
  return (
    <div className="pdf-pane">
      <div className="pdf-page">
        <canvas ref={canvas} aria-label={`PDF page ${page}`} />
        {bbox && <span className="pdf-box" style={{ left: `${bbox[0] * 100}%`, top: `${bbox[1] * 100}%`, width: `${bbox[2] * 100}%`, height: `${bbox[3] * 100}%` }} />}
      </div>
      <div className="row">
        <button type="button" className="btn ghost" onClick={() => onPage(page - 1)} disabled={page <= 1}>Prev</button>
        <span className="muted step-count">Page {page}{count ? ` of ${count}` : ""}</span>
        <button type="button" className="btn ghost" onClick={() => onPage(page + 1)} disabled={!count || page >= count}>Next</button>
        <button type="button" className="btn ghost" aria-expanded={menu} disabled={!saved.length} onClick={() => setMenu(!menu)}>Saved ▾</button>
      </div>
      {menu && (
        <ul>{saved.map((s) => <li key={s.id}><button type="button" className="btn ghost" onClick={() => { setMenu(false); onOpen(s.id); }}>{s.label}</button></li>)}</ul>
      )}
    </div>
  );
}
