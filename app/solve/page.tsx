import Solver from "./Solver";

export const metadata = { title: "Solve | StepWise" };

export default function SolvePage() {
  return (
    <main className="wrap">
      <header className="page-head">
        <p className="kicker">Solve</p>
        <h1>What are we working on?</h1>
        <p className="muted">Math, science, word problems: type it or snap a photo.</p>
      </header>
      <Solver />
    </main>
  );
}
