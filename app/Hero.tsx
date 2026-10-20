"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Headline lines rise on load; the board then tilts flat and scales up as you scroll into it.
export default function Hero({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from(q(".hero-line"), { yPercent: 105, duration: 0.9, stagger: 0.09 })
        .from(q(".mark"), { backgroundSize: "0% 100%", duration: 0.7, ease: "power2.inOut" }, "-=0.3")
        .from(q(".lead, .hero > .btn"), { y: 16, opacity: 0, duration: 0.6, stagger: 0.08 }, "-=0.5")
        .from(q(".showcase"), { y: 60, opacity: 0, duration: 1 }, "-=0.5");
      gsap.fromTo(q(".frame"), { rotateX: 18, scale: 0.88 }, {
        rotateX: 0, scale: 1, ease: "none",
        scrollTrigger: { trigger: q(".showcase")[0], start: "top 95%", end: "top 25%", scrub: 0.3 },
      });
    }, root);
    return () => mm.revert();
  }, []);
  return <section className="hero" ref={root}>{children}</section>;
}
