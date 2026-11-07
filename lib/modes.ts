import type { Entry, Mode } from "./history.ts";
import { MAX_TOPIC } from "./validate.ts";

export const MODES: { id: Mode; label: string }[] = [
  { id: "solver", label: "Solver" },
  { id: "whiteboard", label: "Whiteboard Tutor" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Quiz" },
  { id: "guide", label: "Study Guide" },
];

export const hrefFor = (e: Entry) => (e.mode === "whiteboard" ? `/home/whiteboard-tutor/${e.id}` : `/chat/${e.id}`);

export const canSubmit = (text: string, hasImage: boolean) =>
  text.length <= MAX_TOPIC && (text.trim().length > 0 || hasImage);
