import type { ReactNode } from "react";
import Nav from "./Nav";
import "./globals.css";

export const metadata = {
  title: "StepWise: step-by-step AI homework help",
  description: "Type or snap a problem and get a clear, step-by-step solution.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* apply the saved theme before first paint so there's no flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}` }} />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Nunito:wght@400;600;700;800;900&display=swap" />
      </head>
      <body>
        <Nav />
        {children}
        <footer className="foot">
          <div className="wrap">
            <p><strong>StepWise</strong><span className="muted">Learn the method, not just copy the answer.</span></p>
            <nav aria-label="Footer"><a href="/solve">Solve</a><a href="/board">Board</a><a href="/pdf">PDF</a></nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
