import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
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
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Poppins:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        <div className="shell">
          <Sidebar />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
