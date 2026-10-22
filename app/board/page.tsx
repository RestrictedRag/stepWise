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
    <main className="board-page">
      {script ? <Teach demo={script} demoKey={key} demos={Object.keys(DEMOS)} /> : <p role="alert">{error}</p>}
    </main>
  );
}
