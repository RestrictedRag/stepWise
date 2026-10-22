import Link from "next/link";
import Hero from "./Hero";
import ScrollReveal from "./ScrollReveal";
import Player from "./board/Player";
import { parseBoardScript } from "../lib/board";
import pythagoras from "../lib/fixtures/pythagoras.json";

const SUBJECTS = ["Algebra", "Geometry", "Calculus", "Physics", "Chemistry", "Biology", "Statistics", "Trigonometry", "Word problems", "Earth science"];

const EXAMPLES = [
  ["Math", "#1677ff", "Solve 2x² − 8x + 6 = 0 and explain each step"],
  ["Physics", "#7a5cff", "A ball is dropped from 20 m. How long until it lands?"],
  ["Chemistry", "#00a870", "Balance: Fe + O₂ → Fe₂O₃"],
  ["Biology", "#ff7a1f", "Explain how mitosis differs from meiosis"],
];

const WHY = [
  ["Step-by-step solutions for any subject", "From linear equations to stoichiometry, every move is written out with the reason it works."],
  ["Visual explanations that stick", "The whiteboard tutor draws the idea stroke by stroke, so you see the method, not just read it."],
  ["Photos and handwriting welcome", "Snap the worksheet or paste a screenshot. Messy handwriting is fine."],
  ["Learn it for the test", "Each answer ends with a check, so you know how to do the next one on your own."],
];

export default function Home() {
  const { script } = parseBoardScript(pythagoras);
  return (
    <main>
      <ScrollReveal />
      <Link className="top-link" href="/solve">History</Link>
      <Hero>
        <h1>
          <span className="line"><span className="hero-line">StepWise: Your</span></span>
          <span className="line"><span className="hero-line"><span className="mark">AI Study Companion</span></span></span>
        </h1>
        {/* shortcut: modes are decorative, only Study exists; wire them up when Exam Prep / Writing ship */}
        <div className="seg" aria-hidden="true"><span className="on">Study</span><span>Exam Prep</span><span>Writing</span></div>
        <div className="tool-card">
          <nav className="tool-chips" aria-label="Tools">
            <Link className="tool-chip on" href="/solve">AI Solver</Link>
            <Link className="tool-chip" href="/board">Whiteboard Tutor</Link>
            <Link className="tool-chip" href="/pdf">AI Study</Link>
          </nav>
          <Link className="tool-prompt" href="/solve">Type or upload your question and get step-by-step help…</Link>
        </div>
        <p className="lead">Understand tough problems with clear, visual, step-by-step solutions and finish assignments with confidence.</p>
        <Link className="btn big" href="/solve">Solve your homework</Link>
        <div className="examples">
          {EXAMPLES.map(([tag, color, q]) => (
            <Link key={q} className="example" href="/solve" data-reveal>
              <span className="thumb" style={{ background: color }} aria-hidden="true">{q.slice(0, 18)}</span>
              <span className="subj" style={{ color }}>{tag}</span>
              <span className="ex-q">{q}</span>
            </Link>
          ))}
        </div>
        <div className="showcase">
          <figure className="frame">
            {script && <Player script={script} autoplay bare />}
          </figure>
        </div>
      </Hero>

      <div className="marquee" aria-label="Subjects">
        <ul>
          {[...SUBJECTS, ...SUBJECTS].map((s, n) => <li key={n} aria-hidden={n >= SUBJECTS.length || undefined}>{s}</li>)}
        </ul>
      </div>

      <section className="band how" aria-labelledby="how-title">
        <div className="wrap">
          <p className="kicker center" data-reveal>How it works</p>
          <h2 id="how-title" className="center" data-reveal>How the AI homework helper works</h2>
          <ol className="stack">
            <li>
              <div>
                <h3>Upload your homework</h3>
                <p className="muted">Type the question, paste a screenshot or snap a photo. Pick whatever works for you.</p>
              </div>
              <div className="mock" aria-hidden="true">
                <p className="mock-input">A train travels 120 km in 1.5 h. What is its speed?<span className="caret" /></p>
                <div className="mock-row"><span className="ghost-btn">Add photo</span><span className="solid-btn">Solve</span></div>
              </div>
              <span className="num" aria-hidden="true">1</span>
            </li>
            <li>
              <div>
                <h3>Get every step explained</h3>
                <p className="muted">The AI writes a clear solution with the why behind each move, then checks the answer.</p>
              </div>
              <div className="mock" aria-hidden="true">
                <p className="mock-step">1. Speed = distance ÷ time</p>
                <p className="mock-step">2. 120 km ÷ 1.5 h</p>
                <p className="mock-step final">Answer: <mark>80 km/h</mark></p>
              </div>
              <span className="num" aria-hidden="true">2</span>
            </li>
            <li>
              <div>
                <h3>Watch it on the whiteboard</h3>
                <p className="muted">Pick any topic and the tutor draws the idea out, one stroke at a time, until it clicks.</p>
              </div>
              <div className="mock board-mock" aria-hidden="true">
                <svg viewBox="0 0 240 140">
                  <path className="draw" pathLength={1} d="M40 110 L200 110 L40 30 Z" />
                  <path className="draw hl" pathLength={1} d="M40 110 L40 30" />
                  <text x="22" y="74">a</text><text x="120" y="130">b</text><text x="128" y="62">c</text>
                </svg>
              </div>
              <span className="num" aria-hidden="true">3</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="wrap why" aria-labelledby="why-title">
        <p className="kicker" data-reveal>Why StepWise</p>
        <h2 id="why-title" data-reveal>Why use StepWise’s AI homework helper?</h2>
        <div className="cards">
          {WHY.map(([title, body]) => (
            <article key={title} className="card" data-reveal>
              <h3>{title}</h3>
              <p className="muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap work" aria-labelledby="work-title">
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
            <p className="why-note" aria-hidden="true">…but why?</p>
          </div>
          <div className="answer" data-reveal>
            <p className="tag">StepWise</p>
            <p className="block">1. Subtract 5 from both sides: 3x = 12.{"\n"}<span className="muted">Undo the +5 first so the x term stands alone.</span></p>
            <p className="block">2. Divide both sides by 3: x = 4.{"\n"}<span className="muted">Whatever you do to one side, do to the other.</span></p>
            <p className="block final">Answer: <mark>x = 4</mark>. Check: 3(4) + 5 = 17 ✓</p>
          </div>
        </div>
      </section>

      <Link className="chat-bubble" href="/solve" aria-label="Ask a question">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
      </Link>

      <section className="cta" aria-labelledby="cta-title">
        <div className="cta-card">
          <h2 id="cta-title">Get started with StepWise</h2>
          <p>Bring tonight’s question. Leave knowing how to do the next one yourself.</p>
          <Link className="btn big light" href="/solve">Try for free</Link>
        </div>
      </section>
    </main>
  );
}
