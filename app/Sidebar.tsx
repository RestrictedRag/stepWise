"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, MotionConfig } from "framer-motion";

const I = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const TABS = [
  ["/", "Home", <path key="i" d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />],
  ["/solve", "AI Solver", <path key="i" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />],
  ["/board", "Whiteboard Tutor", <path key="i" d="M3 4h18v12H3zM8 20l4-4 4 4M7 12l3-3 3 2 4-4" />],
  ["/pdf", "AI Study", <path key="i" d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h6" />],
] as const;

export default function Sidebar() {
  const path = usePathname();
  const [dark, setDark] = useState<boolean | null>(null); // null until mounted: the server can't know the theme
  const [mini, setMini] = useState(false);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setDark(t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setDark(!dark);
  };
  return (
    <MotionConfig reducedMotion="user">
      <aside className={mini ? "side mini" : "side"}>
        <div className="side-top">
          <Link href="/" className="logo" aria-label="StepWise home">
            <span className="logo-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 26 26"><path d="M3 21h6v-6h6V9h6V3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <strong>StepWise</strong>
          </Link>
          <button type="button" className="icon-btn collapse" onClick={() => setMini(!mini)} aria-label={mini ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!mini}>
            <svg width="18" height="18" viewBox="0 0 24 24" {...I} aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg>
          </button>
        </div>
        <nav className="side-nav" aria-label="Main">
          {TABS.map(([href, label, icon]) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className="tab" aria-current={on ? "page" : undefined} title={mini ? label : undefined}>
                {on && <motion.span className="pill" layoutId="pill" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                <svg width="20" height="20" viewBox="0 0 24 24" {...I} aria-hidden="true">{icon}</svg>
                <span className="label">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">
          {/* shortcut: badges are decorative (no native apps yet), make them links when the apps ship */}
          <div className="stores" aria-hidden="true">
            <span className="store"><small>Download on the</small>App Store</span>
            <span className="store"><small>Get it on</small>Google Play</span>
          </div>
          <div className="user-row">
            <span className="avatar" aria-hidden="true">S</span>
            <span className="label">Student</span>
            <button type="button" className="icon-btn" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
              <svg width="18" height="18" viewBox="0 0 24 24" {...I} aria-hidden="true">
                {dark
                  ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
                  : <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </MotionConfig>
  );
}
