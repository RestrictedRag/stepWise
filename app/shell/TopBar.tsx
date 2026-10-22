import type { ReactNode } from "react";

export default function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header style={{ height: 56, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 16px" }}>
      {right}
    </header>
  );
}
