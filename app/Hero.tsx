"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

// The one orchestrated moment: headline lines rise, copy settles, the board is taped down.
export default function Hero({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from(q(".eyebrow"), { y: 12, opacity: 0, duration: 0.5 })
        .from(q(".hero-line"), { yPercent: 105, duration: 0.9, stagger: 0.09 }, "-=0.3")
        .from(q(".mark"), { backgroundSize: "0% .32em", duration: 0.6, ease: "power2.inOut" }, "-=0.2")
        .from(q(".lead, .hero .row, .perks li"), { y: 16, opacity: 0, duration: 0.6, stagger: 0.06 }, "-=0.6")
        .from(q(".frame"), { y: 40, opacity: 0, rotate: 1.5, duration: 0.9 }, "-=0.7")
        .from(q(".tape"), { scaleX: 0, duration: 0.35, stagger: 0.1 }, "-=0.3")
        .from(q(".note"), { opacity: 0, duration: 0.3 }, "-=0.1")
        .from(q(".note path"), { strokeDashoffset: 1, duration: 0.6, ease: "power1.inOut" }, "<");
    }, root);
    return () => mm.revert();
  }, []);
  return <section className="hero" ref={root}>{children}</section>;
}
