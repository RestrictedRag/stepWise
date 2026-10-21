"use client";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { renderScale } from "../../lib/pdfrender";

type Props = {
  file: ArrayBuffer; page: number; onPage: (n: number) => void;
  bbox: [number, number, number, number] | null;
  renderRef: MutableRefObject<(() => Promise<string>) | null>;
};

export default function PdfPane({ file, page, onPage, bbox, renderRef }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const doc = useRef<any>(null);
  const done = useRef<Promise<void>>(Promise.resolve());
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let dead = false;
    let loading: { destroy: () => Promise<void> } | undefined;
    setError(""); setCount(0);
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
    done.current = (async () => {
      const p = await doc.current.getPage(Math.min(Math.max(page, 1), count));
      if (dead) return;
      const vp = p.getViewport({ scale: renderScale(p.getViewport({ scale: 1 }).width) });
      const c = canvas.current!;
      c.width = vp.width; c.height = vp.height;
      task = p.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp });
      await task!.promise.catch(() => {}); // a cancelled render rejects; the next page's render takes over
    })();
    return () => { dead = true; task?.cancel(); };
  }, [count, page]);

  useEffect(() => {
    renderRef.current = async () => {
      await done.current;
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
      </div>
    </div>
  );
}
