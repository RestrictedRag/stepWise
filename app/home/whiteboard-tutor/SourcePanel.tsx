"use client";

import { useEffect, useRef, useState } from "react";
import { renderScale } from "../../../lib/pdfrender";

// shortcut: sources are display-only, not sent to /api/lesson; wire when lesson API accepts context

type Src = { key: string; kind: "image"; url: string } | { key: string; kind: "pdf"; file: File };

const clamp = (w: number) => Math.max(175, Math.min(295, w));

function PdfThumbs({ file }: { file: File }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let dead = false;
    let worker: { destroy: () => unknown } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        // own worker per mount: destroying a shared one (strict-mode remount) stalls the live load
        const w = new pdfjs.PDFWorker();
        worker = w;
        if (dead) return void w.destroy();
        const d = await pdfjs.getDocument({ data: await file.arrayBuffer(), worker: w }).promise;
        for (let n = 1; n <= d.numPages && !dead; n++) {
          const p = await d.getPage(n);
          const vp = p.getViewport({ scale: renderScale(p.getViewport({ scale: 1 }).width) });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.width = "100%"; c.style.border = "1px solid var(--line)"; c.style.borderRadius = "6px";
          await p.render({ canvas: c, viewport: vp }).promise;
          if (dead || !box.current) return;
          const fig = document.createElement("figure");
          fig.style.margin = "0 0 10px";
          const cap = document.createElement("figcaption");
          cap.textContent = `PAGE ${n}`;
          cap.style.cssText = "font-size:11px;color:var(--muted);letter-spacing:.05em;margin-bottom:4px";
          fig.append(cap, c);
          box.current.append(fig);
        }
      } catch {
        if (!dead) setErr(true);
      }
    })();
    return () => { dead = true; worker?.destroy(); if (box.current) box.current.textContent = ""; };
  }, [file]);

  return err ? <p style={{ color: "#c0392b", fontSize: 13 }}>Could not open that PDF.</p> : <div ref={box} />;
}

export default function SourcePanel() {
  const [width, setWidth] = useState(240);
  const [srcs, setSrcs] = useState<Src[]>([]);
  const live = useRef(srcs);
  live.current = srcs;

  // revoke on unmount only; revoking per change would break thumbnails still on screen
  useEffect(() => () => live.current.forEach((s) => s.kind === "image" && URL.revokeObjectURL(s.url)), []);

  function add(files: FileList | null) {
    if (!files) return;
    const next: Src[] = [];
    for (const f of Array.from(files)) {
      const key = `${f.name}-${f.size}-${Math.random()}`;
      if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) next.push({ key, kind: "pdf", file: f });
      else if (f.type.startsWith("image/")) next.push({ key, kind: "image", url: URL.createObjectURL(f) });
    }
    setSrcs((s) => [...s, ...next]);
  }

  function drag(e: React.PointerEvent) {
    const x0 = e.clientX, w0 = width;
    const move = (m: PointerEvent) => setWidth(clamp(w0 + m.clientX - x0));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <aside data-source-panel style={{ width, flexShrink: 0, position: "relative", borderRight: "1px solid var(--line)", background: "var(--bg)", overflowY: "auto", padding: 12 }}>
      <h2 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", margin: "0 0 10px" }}>Course source</h2>
      <label style={{ display: "block", border: "1px dashed var(--line)", borderRadius: 8, padding: 14, textAlign: "center", cursor: "pointer", marginBottom: 12, fontSize: 14 }}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
        Upload files
        <input type="file" accept="image/*,.pdf" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {srcs.map((s) => s.kind === "image"
        ? <img key={s.key} src={s.url} alt="" style={{ width: "100%", borderRadius: 6, border: "1px solid var(--line)", marginBottom: 10 }} />
        : <PdfThumbs key={s.key} file={s.file} />)}
      <div role="separator" aria-orientation="vertical" aria-label="Resize source panel" onPointerDown={drag}
        style={{ position: "absolute", top: 0, right: 0, width: 6, height: "100%", cursor: "col-resize" }} />
    </aside>
  );
}
