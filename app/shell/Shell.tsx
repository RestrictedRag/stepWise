"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true);
  }, []);

  // lesson page is full-width with its own source panel
  if (path.startsWith("/home/whiteboard-tutor/")) return <>{children}</>;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar reads useSearchParams; without Suspense static prerender (/_not-found) fails */}
      <Suspense>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </Suspense>
      <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>{children}</main>
    </div>
  );
}
