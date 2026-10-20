"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";

const TABS = [["/", "Home"], ["/solve", "Solve"], ["/board", "Board"]] as const;

export default function Nav() {
  const path = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <header className="nav-bar"><div className="nav wrap">
        <Link href="/" className="logo" aria-label="StepWise home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M3 21h6v-6h6V9h6V3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Step<span>Wise</span>
        </Link>
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
      </div></header>
    </MotionConfig>
  );
}
