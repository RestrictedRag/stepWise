"use client";
import { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
gsap.config({ nullTargetWarn: false }); // not every step has .mock-step or .draw children

// Scroll-driven motion for the home page: batched fade-ups, scrubbed step mockups,
// a progress rail through "How it works", and a marquee that speeds up with scroll.
export default function ScrollReveal() {
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.set("[data-reveal]", { y: 32, opacity: 0 });
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 90%",
        once: true,
        onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.1 }),
      });

      gsap.utils.toArray<HTMLElement>(".stack > li").forEach((li, n) => {
        const st = { trigger: li, start: "top 85%", end: "top 35%", scrub: 0.3 };
        gsap.from(li.querySelector(".mock"), { x: n % 2 ? -80 : 80, rotate: n % 2 ? -4 : 4, opacity: 0, ease: "none", scrollTrigger: st });
        gsap.from(li.firstElementChild, { y: 40, opacity: 0, ease: "none", scrollTrigger: st });
        gsap.from(li.querySelectorAll(".mock-step"), { x: -20, opacity: 0, stagger: 0.3, ease: "none", scrollTrigger: st });
        gsap.from(li.querySelectorAll(".draw"), { strokeDashoffset: 1, stagger: 0.4, ease: "none", scrollTrigger: st });
      });
      gsap.from(".stack", {
        "--rail": 0, ease: "none",
        scrollTrigger: { trigger: ".stack", start: "top 60%", end: "bottom 60%", scrub: 0.3 },
      });

      const loop = gsap.to(".marquee ul", { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
      ScrollTrigger.create({
        onUpdate: (self) => gsap.fromTo(loop,
          { timeScale: 1 + Math.min(Math.abs(self.getVelocity()) / 300, 6) },
          { timeScale: 1, duration: 0.8, ease: "power2.out", overwrite: true }),
      });
    });
    return () => mm.revert();
  }, []);
  return null;
}
