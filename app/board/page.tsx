import Link from "next/link";
import Player from "./Player";
import Teach from "./Teach";
import { parseBoardScript } from "../../lib/board";
import cell from "../../lib/fixtures/cell.json";
import waterCycle from "../../lib/fixtures/water-cycle.json";
import pythagoras from "../../lib/fixtures/pythagoras.json";
import photosynthesis from "../../lib/fixtures/photosynthesis.json";

const DEMOS: Record<string, unknown> = { cell, "water-cycle": waterCycle, pythagoras, photosynthesis };

export const metadata = { title: "Board | StepWise" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  const key = demo && Object.hasOwn(DEMOS, demo) ? demo : "cell";
  const { script, error } = parseBoardScript(DEMOS[key]);
  return (
    <main className="wrap">
      <header className="page-head">
        <p className="kicker">Board</p>
        <h1>Watch it come together.</h1>
        <p className="muted">Name a topic and the tutor draws it out, one stroke at a time.</p>
      </header>
      <Teach />
      <div className="lesson-head">
        <p className="kicker">Sample lesson</p>
        <h2>{script?.title ?? "Board"}</h2>
        {script?.subtitle && <p className="muted">{script.subtitle}</p>}
      </div>
      {script ? <Player key={key} script={script} /> : <p role="alert">{error}</p>}
      <nav className="row demos" aria-label="Demo lessons">
        {Object.keys(DEMOS).map((k) => (
          <Link key={k} href={`/board?demo=${k}`} className="btn ghost" aria-current={k === key ? "page" : undefined}>{k}</Link>
        ))}
      </nav>
    </main>
  );
}
