import PdfStudio from "./PdfStudio";

export const metadata = { title: "PDF | StepWise" };

export default function PdfPage() {
  return (
    <main className="wrap">
      <header className="page-head">
        <p className="kicker">AI Study</p>
        <h1>Study from your own PDFs.</h1>
        <p className="muted">Upload a PDF, say which question you mean, and watch it explained on the board.</p>
      </header>
      <PdfStudio />
    </main>
  );
}
