import PdfStudio from "./PdfStudio";

export const metadata = { title: "PDF | StepWise" };

export default function PdfPage() {
  return (
    <main className="wrap">
      <header className="page-head">
        <p className="kicker">PDF</p>
        <h1>Point at a question, get it taught.</h1>
        <p className="muted">Upload a PDF, say which question you mean, and watch it explained on the board.</p>
      </header>
      <PdfStudio />
    </main>
  );
}
