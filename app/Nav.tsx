"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, MotionConfig } from "framer-motion";

const TABS = [["/", "Home"], ["/solve", "Solve"], ["/board", "Board"]] as const;

export default function Nav() {
  const path = usePathname();
  const [dark, setDark] = useState<boolean | null>(null); // null until mounted: the server can't know the theme
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
      <header className="nav-bar"><div className="nav wrap">
        <Link href="/" className="logo" aria-label="StepWise home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M3 21h6v-6h6V9h6V3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <strong>step<span>Wise</span></strong>
        </Link>
        <div className="nav-end">
        <nav className="tabs" aria-label="Main">
          {TABS.map(([href, label]) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className="tab" aria-current={on ? "page" : undefined}>
                {on && <motion.span className="pill" layoutId="pill" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <button type="button" className="theme-btn" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {dark
              ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
              : <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
          </svg>
        </button>
        </div>
      </div></header>
    </MotionConfig>
  );
}
