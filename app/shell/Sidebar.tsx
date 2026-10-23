"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { listEntries, type Entry } from "../../lib/history";
import { hrefFor } from "../../lib/modes";

const icon = (d: string): ReactNode => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

// mode: undefined = plain "/" link; "" = Home (active on "/" with no ?mode)
const NAV: { label: string; icon: ReactNode; mode?: string; badge?: string }[] = [
  { label: "New chat", icon: icon("M12 5v14M5 12h14") },
  { label: "Home", icon: icon("M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"), mode: "" },
  { label: "Whiteboard Tutor", icon: icon("M3 4h18v12H3zM8 20h8M12 16v4"), mode: "whiteboard", badge: "New" },
  { label: "Flashcards", icon: icon("M4 7h12v12H4zM8 3h12v12"), mode: "flashcards" },
  { label: "Quiz", icon: icon("M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01"), mode: "quiz" },
  { label: "Study Guide", icon: icon("M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3zM18 8h2v12"), mode: "guide" },
];


const row = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, fontSize: 14, color: "var(--text)", textDecoration: "none" } as const;

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const path = usePathname() ?? "/";
  const mode = useSearchParams()?.get("mode") ?? "";
  const [history, setHistory] = useState<Entry[]>([]);

  useEffect(() => {
    const load = () => setHistory(listEntries());
    load();
    window.addEventListener("solvely:history", load);
    return () => window.removeEventListener("solvely:history", load);
  }, []);

  return (
    <aside style={{ width: collapsed ? 64 : 260, flexShrink: 0, background: "var(--side)", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", padding: "14px 10px", transition: "width .2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 14px" }}>
        {!collapsed && (
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, color: "var(--text)", textDecoration: "none", fontWeight: 700, fontSize: 17 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--blue)", color: "#fff", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800 }}>S</span>
            Solvely
          </Link>
        )}
        <button className="nav-item" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} style={{ ...row, padding: 6, border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }}>
          {icon("M4 4h16v16H4zM9 4v16")}
        </button>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = n.mode !== undefined && path === "/" && mode === n.mode;
          return (
            <Link key={n.label} href={n.mode ? `/?mode=${n.mode}` : "/"} className="nav-item" title={n.label} style={{ ...row, background: active ? "var(--line)" : undefined, fontWeight: active ? 600 : 400 }}>
              {n.icon}
              {!collapsed && <span style={{ flex: 1 }}>{n.label}</span>}
              {!collapsed && n.badge && <span style={{ fontSize: 11, color: "var(--blue)", background: "#e8efff", borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>{n.badge}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ marginTop: 18, minHeight: 0, overflow: "auto" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 10px 6px" }}>History</div>
          {history.map((e) => (
            <Link key={e.id} href={hrefFor(e)} className="nav-item" style={{ ...row, display: "block", padding: "6px 10px", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {e.prompt || "Untitled"}
            </Link>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {!collapsed && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* visual only: no payments in scope */}
          <button style={{ flex: 1, height: 40, border: 0, borderRadius: 10, background: "var(--blue)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Upgrade</button>
          <button aria-label="Theme" className="nav-item" style={{ ...row, padding: 8, border: 0, background: "none", cursor: "pointer", color: "var(--muted)" }}>
            {icon("M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z")}
          </button>
        </div>
      )}
    </aside>
  );
}
