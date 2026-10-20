import Link from "next/link";
import Hero from "./Hero";
import ScrollReveal from "./ScrollReveal";
import Player from "./board/Player";
import { parseBoardScript } from "../lib/board";
import pythagoras from "../lib/fixtures/pythagoras.json";

const STEPS = [
  ["Type it or snap it", "Paste a question or drop in a photo of the worksheet. Handwriting is fine."],
  ["Read every step", "Each step says what to do and why it works, so the method sticks."],
  ["Watch it on the board", "Pick any topic and the tutor draws the idea out, one stroke at a time."],
];

const SUBJECTS = ["Algebra", "Geometry", "Calculus", "Physics", "Chemistry", "Biology", "Statistics", "Trigonometry", "Word problems", "Earth science"];

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function Home() {
  const { script } = parseBoardScript(pythagoras);
  return (
    <main>
      <ScrollReveal />
      <div className="wrap">
        <Hero>
          <div>
            <p className="eyebrow"><span className="dot" aria-hidden="true" />Your AI tutor for math, science and word problems</p>
            <h1>
              <span className="line"><span className="hero-line">Homework,</span></span>
              <span className="line"><span className="hero-line"><span className="mark">one clear step</span></span></span>
              <span className="line"><span className="hero-line">at a time.</span></span>
            </h1>
            <p className="lead">StepWise is a patient tutor that shows the working, then draws it out on a whiteboard until it clicks.</p>
            <div className="row start">
              <Link className="btn big" href="/solve">Solve a problem <span className="arr" aria-hidden="true">→</span></Link>
              <Link className="btn big ghost" href="/board?demo=pythagoras">Watch a lesson</Link>
            </div>
            <ul className="perks">
              <li><Check />Snap a photo</li>
              <li><Check />Handwriting OK</li>
              <li><Check />Every step explained</li>
            </ul>
          </div>
          <figure className="frame">
            <span className="tape l" aria-hidden="true" />
            <span className="tape r" aria-hidden="true" />
            <p className="note" aria-hidden="true">
              watch it draw
              <svg width="44" height="36" viewBox="0 0 44 36">
                <path pathLength={1} d="M4 6c14 0 26 6 32 22m0 0l-8-4m8 4l3-9" />
              </svg>
            </p>
            {script && <Player script={script} autoplay bare />}
          </figure>
        </Hero>
      </div>

      <div className="marquee" aria-label="Subjects">
        <ul>
          {[...SUBJECTS, ...SUBJECTS].map((s, n) => <li key={n} aria-hidden={n >= SUBJECTS.length || undefined}>{s}</li>)}
        </ul>
      </div>

      <div className="wrap">
        <section className="how" aria-labelledby="how-title">
          <p className="kicker" data-reveal>How it works</p>
          <h2 id="how-title" data-reveal>From stuck to sure in three moves.</h2>
          <ol className="steps">
            {STEPS.map(([title, body], n) => (
              <li key={title} data-reveal>
                <span className="num" aria-hidden="true">{n + 1}</span>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="work" aria-labelledby="work-title">
          <div data-reveal>
            <p className="kicker">Show the work</p>
            <h2 id="work-title">Not just the answer.<br />The reason behind it.</h2>
            <p className="muted">Answer-only apps get you through tonight. Seeing why each move works gets you through the test.</p>
          </div>
          <div className="compare">
            <div className="bare-answer" data-reveal>
              <p className="tag">Answer only</p>
              <p className="q">3x + 5 = 17</p>
              <p className="x">x = 4</p>
              <p className="why" aria-hidden="true">…but why?</p>
            </div>
            <div className="answer" data-reveal>
              <p className="tag">StepWise</p>
              <p className="block">1. Subtract 5 from both sides: 3x = 12.{"\n"}<span className="muted">Undo the +5 first so the x term stands alone.</span></p>
              <p className="block">2. Divide both sides by 3: x = 4.{"\n"}<span className="muted">Whatever you do to one side, do to the other.</span></p>
              <p className="block final">Answer: <mark>x = 4</mark>. Check: 3(4) + 5 = 17 ✓</p>
            </div>
          </div>
        </section>

        <section className="cta" data-reveal>
          <div className="cta-card">
            <h2>Stuck on tonight's homework?</h2>
            <p>Bring the question. Leave knowing how to do the next one yourself.</p>
            <Link className="btn big" href="/solve">Start solving <span className="arr" aria-hidden="true">→</span></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
