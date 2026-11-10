"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LessonManifest, CompiledStepManifest } from "../../../lib/manifest";
import { revealCount, paceMs, pacedCount, boardText } from "../../../lib/liveboard/reveal";
import { interpolateClock } from "../../../lib/liveboard/clockInterpolator";

export interface BoardBlock {
  id: string;
  columnIndex: number;
  stepIndex: number;
  transcript: string;
  note?: string;
  durationMs: number;
  speechMarks?: any[];
  commands: any[];
  diagram?: { svg: string; alt: string };
  checkpoint?: any;
  title?: string;
  subtitle?: string;
}

const speak = (t: string) =>
  fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: t }),
  })
    .then((r) => (r.ok ? r.blob() : null))
    .catch(() => null);

export function useLessonPlayer(initialManifest: LessonManifest | null) {
  const [columns, setColumns] = useState<LessonManifest[]>(() =>
    initialManifest ? [initialManifest] : []
  );
  const [blocks, setBlocks] = useState<BoardBlock[]>([]);
  const [revealed, setRevealed] = useState<Record<string, number>>({});
  const [stepElapsedMs, setStepElapsedMs] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeedState] = useState<number>(1);

  // Queue coordinates: [columnIndex, stepIndex]
  const currentCoord = useRef<{ col: number; step: number }>({ col: 0, step: 0 });
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, Promise<HTMLAudioElement | null>>>(new Map());
  const blobUrls = useRef<string[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const isStarted = useRef(false);

  // Sub-frame clock tracking
  const lastAudioMsRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const prevCountRef = useRef<Record<string, number>>({});
  const silentRafRef = useRef<number>(0);

  // 60fps rAF interpolation loop for smooth continuous reveal & stroke progress
  useEffect(() => {
    if (!playing) return;
    let animId: number;

    const frame = () => {
      const audio = currentAudioRef.current;
      const { col, step } = currentCoord.current;
      const blockId = `block-${col}-${step}`;

      if (audio && !audio.paused && !audio.ended) {
        const now = performance.now();
        const interpolated = interpolateClock(
          lastAudioMsRef.current,
          lastTickRef.current,
          now,
          speedRef.current,
          350
        );

        setStepElapsedMs((prev) => {
          if (prev[blockId] === interpolated) return prev;
          return { ...prev, [blockId]: interpolated };
        });

        const manifest = columns[col];
        const stepDef = manifest?.steps[step];
        if (stepDef) {
          const realDurMs =
            audio.duration && !isNaN(audio.duration) && audio.duration > 0
              ? audio.duration * 1000
              : stepDef.speech.durationMs;

          const currentCount = prevCountRef.current[blockId] || 0;
          const nextCount = stepDef.speech.note
            // Short note: the speech marks index into the narration, not the note, so pace it Solvely-style.
            ? pacedCount(
                boardText(stepDef.speech).length,
                interpolated,
                realDurMs > 0 ? interpolated / realDurMs : 0,
                currentCount
              )
            : revealCount(
                stepDef.speech.speechMarks,
                interpolated,
                realDurMs,
                stepDef.speech.durationMs,
                currentCount,
                stepDef.speech.transcript.length
              );

          if (nextCount !== currentCount) {
            prevCountRef.current[blockId] = nextCount;
            setRevealed((prev) => ({ ...prev, [blockId]: nextCount }));
          }
        }
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [playing, columns]);

  // Prefetch audio for a given step
  const getAudioForStep = useCallback((colIdx: number, stepIdx: number, step: CompiledStepManifest) => {
    const key = `${colIdx}:${stepIdx}`;
    if (audioCache.current.has(key)) {
      return audioCache.current.get(key)!;
    }

    const promise = (async () => {
      if (step.speech.audioUrl) {
        const a = new Audio(step.speech.audioUrl);
        a.preload = "auto";
        return a;
      }
      const blob = await speak(step.speech.transcript);
      if (!blob) {
        audioCache.current.delete(key); // let a later play retry the voice
        return null;
      }
      const url = URL.createObjectURL(blob);
      blobUrls.current.push(url);
      const a = new Audio(url);
      a.preload = "auto";
      return a;
    })();

    audioCache.current.set(key, promise);
    return promise;
  }, []);

  // Play a specific step
  const playStep = useCallback(async (colIdx: number, stepIdx: number, manifestList: LessonManifest[]) => {
    const manifest = manifestList[colIdx];
    if (!manifest || !manifest.steps[stepIdx]) {
      setPlaying(false);
      return;
    }

    const step = manifest.steps[stepIdx];
    const blockId = `block-${colIdx}-${stepIdx}`;

    // Append block to DOM if not already appended
    setBlocks((prev) => {
      if (prev.some((b) => b.id === blockId)) return prev;
      return [
        ...prev,
        {
          id: blockId,
          columnIndex: colIdx,
          stepIndex: stepIdx,
          transcript: step.speech.transcript,
          note: step.speech.note,
          durationMs: step.speech.durationMs,
          speechMarks: step.speech.speechMarks,
          commands: step.commands,
          diagram: step.diagram,
          checkpoint: (step as any).checkpoint,
          title: stepIdx === 0 ? manifest.title : undefined,
          subtitle: stepIdx === 0 ? (manifest as any).subtitle : undefined,
        },
      ];
    });

    currentCoord.current = { col: colIdx, step: stepIdx };

    // Stop previous audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.ontimeupdate = null;
      currentAudioRef.current = null;
    }

    const audio = await getAudioForStep(colIdx, stepIdx, step);
    // The user moved on while the voice was loading.
    if (currentCoord.current.col !== colIdx || currentCoord.current.step !== stepIdx) return;

    // Prefetch next step's audio
    const nextStepIdx = stepIdx + 1;
    if (manifest.steps[nextStepIdx]) {
      getAudioForStep(colIdx, nextStepIdx, manifest.steps[nextStepIdx]);
    } else if (manifestList[colIdx + 1]?.steps[0]) {
      getAudioForStep(colIdx + 1, 0, manifestList[colIdx + 1].steps[0]);
    }

    if (!audio) {
      // No voice: write at Solvely's pace in silence.
      const text = boardText(step.speech);
      const len = text.length;
      // The step still lasts as long as the narration would, so a short note does not make the lesson race.
      const total = Math.max(paceMs(len), paceMs(step.speech.transcript.length), step.speech.durationMs || 0);
      let elapsed = 0;
      let shown = 0;
      let last = performance.now();
      cancelAnimationFrame(silentRafRef.current);
      const tick = (now: number) => {
        const delta = Math.min(now - last, 100); // tab was in the background
        last = now;
        if (currentCoord.current.col !== colIdx || currentCoord.current.step !== stepIdx) return; // superseded
        if (playingRef.current) {
          elapsed += delta * speedRef.current;
          const next = step.speech.note
            ? pacedCount(len, elapsed, 0, shown)
            : revealCount(step.speech.speechMarks, elapsed, total, step.speech.durationMs, shown, len);
          if (next !== shown) {
            shown = next;
            prevCountRef.current[blockId] = next;
            setRevealed((p) => ({ ...p, [blockId]: next }));
          }
          setStepElapsedMs((p) => ({ ...p, [blockId]: elapsed }));
        }
        if (elapsed >= total) {
          setRevealed((p) => ({ ...p, [blockId]: Infinity }));
          setStepElapsedMs((p) => ({ ...p, [blockId]: Infinity }));
          prevCountRef.current[blockId] = Infinity;
          if ((step as any).checkpoint) setPlaying(false);
          else advanceNext(colIdx, stepIdx, manifestList);
          return;
        }
        silentRafRef.current = requestAnimationFrame(tick);
      };
      silentRafRef.current = requestAnimationFrame(tick);
      return;
    }

    currentAudioRef.current = audio;
    audio.playbackRate = speedRef.current;
    lastAudioMsRef.current = 0;
    lastTickRef.current = performance.now();
    prevCountRef.current[blockId] = 0;

    audio.ontimeupdate = () => {
      const audioTimeMs = audio.currentTime * 1000;
      lastAudioMsRef.current = audioTimeMs;
      lastTickRef.current = performance.now();
    };

    audio.onended = () => {
      setRevealed((p) => ({ ...p, [blockId]: Infinity }));
      setStepElapsedMs((p) => ({ ...p, [blockId]: Infinity }));
      prevCountRef.current[blockId] = Infinity;
      if ((step as any).checkpoint) {
        setPlaying(false);
      } else {
        advanceNext(colIdx, stepIdx, manifestList);
      }
    };

    if (playingRef.current) {
      audio.play().catch(() => {});
      lastAudioMsRef.current = (audio.currentTime || 0) * 1000;
      lastTickRef.current = performance.now();
    }
  }, [getAudioForStep]);

  const advanceNext = useCallback((colIdx: number, stepIdx: number, manifestList: LessonManifest[]) => {
    const curManifest = manifestList[colIdx];
    if (curManifest && curManifest.steps[stepIdx + 1]) {
      playStep(colIdx, stepIdx + 1, manifestList);
    } else if (manifestList[colIdx + 1] && manifestList[colIdx + 1].steps[0]) {
      playStep(colIdx + 1, 0, manifestList);
    } else {
      setPlaying(false);
    }
  }, [playStep]);

  // Handle initial manifest load
  useEffect(() => {
    if (initialManifest && !isStarted.current) {
      isStarted.current = true;
      setColumns([initialManifest]);
      playStep(0, 0, [initialManifest]);
    }
  }, [initialManifest, playStep]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(silentRafRef.current);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
      blobUrls.current = [];
    };
  }, []);

  const toggle = useCallback(() => {
    if (playing) {
      currentAudioRef.current?.pause();
      setPlaying(false);
    } else {
      if (currentAudioRef.current) {
        lastAudioMsRef.current = (currentAudioRef.current.currentTime || 0) * 1000;
        lastTickRef.current = performance.now();
        currentAudioRef.current.play().catch(() => {});
      }
      setPlaying(true);
    }
  }, [playing]);

  const setSpeed = useCallback((newSpeed: number) => {
    setSpeedState(newSpeed);
    speedRef.current = newSpeed;
    if (currentAudioRef.current) {
      lastAudioMsRef.current = (currentAudioRef.current.currentTime || 0) * 1000;
      lastTickRef.current = performance.now();
      currentAudioRef.current.playbackRate = newSpeed;
    }
  }, []);

  const appendColumn = useCallback((manifest: LessonManifest) => {
    setColumns((prev) => {
      const next = [...prev, manifest];
      const newColIdx = next.length - 1;
      // Start playing the newly added column immediately
      playStep(newColIdx, 0, next);
      setPlaying(true);
      return next;
    });
  }, [playStep]);

  return {
    blocks,
    revealed,
    stepElapsedMs,
    playing,
    toggle,
    speed,
    setSpeed,
    appendColumn,
  };
}

