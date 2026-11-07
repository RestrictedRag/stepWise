import type { ReactNode } from "react";
import { Inter, Kalam } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import Shell from "./shell/Shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-ui" });
const kalam = Kalam({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-board" });

export const metadata = { title: "StepWise: step-by-step AI homework help" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${kalam.variable}`}><Shell>{children}</Shell></body>
    </html>
  );
}
