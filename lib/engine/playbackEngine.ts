// StepWise Playback Engine: Master-clock driven animation timeline with bi-directional scrubbing.
import type { VectorCommand, StepManifest } from "../manifest.ts";

export interface CommandRuntimeState {
  command: VectorCommand;
  status: "pending" | "active" | "completed";
  progress: number; // 0.0 to 1.0
}

export interface EngineActiveState {
  timeMs: number;
  durationMs: number;
  progress: number;
  activeCommandIds: Set<string>;
  completedCommandIds: Set<string>;
  highlightedElementIds: Map<string, { style: string; intensity: number }>;
  erasedElementIds: Set<string>;
  stylusPosition: { x: number; y: number; active: boolean } | null;
  cameraViewport: { x: number; y: number; width: number; height: number } | null;
}

export type PlaybackListener = (state: EngineActiveState) => void;

export class StepWisePlaybackEngine {
  private step: StepManifest;
  private audio: HTMLAudioElement | null = null;
  private currentTimeMs: number = 0;
  private durationMs: number = 1000;
  private isPlaying: boolean = false;
  private isScrubbing: boolean = false;
  private speed: number = 1.0;
  private rafId: number | null = null;
  private lastRafTimestamp: number | null = null;
  private listeners: Set<PlaybackListener> = new Set();
  private onStepCompleteCallback: (() => void) | null = null;

  constructor(step: StepManifest) {
    this.step = step;
    this.durationMs = Math.max(500, step.speech.durationMs);
    this.seekMs(0);
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.computeStateAt(this.currentTimeMs));
    return () => this.listeners.delete(listener);
  }

  public onComplete(cb: () => void) {
    this.onStepCompleteCallback = cb;
  }

  public bindAudio(audio: HTMLAudioElement) {
    this.audio = audio;
    this.audio.playbackRate = this.speed;
    this.durationMs = Math.max(this.durationMs, Math.round((audio.duration || 0) * 1000));

    audio.onended = () => {
      this.pause();
      this.seekMs(this.durationMs);
      this.onStepCompleteCallback?.();
    };
  }

  public play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.audio) {
      this.audio.currentTime = this.currentTimeMs / 1000;
      this.audio.playbackRate = this.speed;
      this.audio.play().catch(() => {
        // Fallback to internal clock if audio play is blocked or unavailable
      });
    }

    this.lastRafTimestamp = null;
    this.startLoop();
  }

  public pause() {
    this.isPlaying = false;
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    if (this.rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setSpeed(multiplier: number) {
    this.speed = Math.max(0.25, Math.min(3.0, multiplier));
    if (this.audio) {
      this.audio.playbackRate = this.speed;
    }
  }

  public startScrub() {
    this.isScrubbing = true;
    this.pause();
  }

  public scrubToMs(targetMs: number) {
    this.seekMs(targetMs);
  }

  public endScrub(resumePlayback: boolean) {
    this.isScrubbing = false;
    if (resumePlayback && this.currentTimeMs < this.durationMs) {
      this.play();
    }
  }

  public seekMs(targetMs: number) {
    this.currentTimeMs = Math.max(0, Math.min(this.durationMs, targetMs));
    if (this.audio) {
      this.audio.currentTime = this.currentTimeMs / 1000;
    }
    const state = this.computeStateAt(this.currentTimeMs);
    this.emit(state);
  }

  public tickManual(deltaMs: number) {
    if (!this.isPlaying) return;
    const nextMs = this.currentTimeMs + deltaMs * this.speed;
    if (nextMs >= this.durationMs) {
      this.seekMs(this.durationMs);
      this.pause();
      this.onStepCompleteCallback?.();
    } else {
      this.seekMs(nextMs);
    }
  }

  public computeStateAt(timeMs: number): EngineActiveState {
    const activeCommandIds = new Set<string>();
    const completedCommandIds = new Set<string>();
    const highlightedElementIds = new Map<string, { style: string; intensity: number }>();
    const erasedElementIds = new Set<string>();
    let cameraViewport: { x: number; y: number; width: number; height: number } | null = null;
    let stylusPosition: { x: number; y: number; active: boolean } | null = null;

    for (const cmd of this.step.commands) {
      const start = cmd.startMs;
      const end = cmd.startMs + cmd.durationMs;

      if (timeMs >= end) {
        completedCommandIds.add(cmd.id);
        if (cmd.action === "ERASE") {
          cmd.targetElementIds.forEach((id) => erasedElementIds.add(id));
        }
        if (cmd.action === "CAMERA_ZOOM") {
          cameraViewport = cmd.targetViewport;
        }
      } else if (timeMs >= start) {
        activeCommandIds.add(cmd.id);
        const progress = (timeMs - start) / Math.max(1, cmd.durationMs);

        if (cmd.action === "HIGHLIGHT") {
          highlightedElementIds.set(cmd.targetElementId, {
            style: cmd.style,
            intensity: Math.sin(progress * Math.PI), // pulse arc
          });
        } else if (cmd.action === "ERASE") {
          // Progressively erasing
          cmd.targetElementIds.forEach((id) => erasedElementIds.add(id));
        } else if (cmd.action === "DRAW" && cmd.style.showStylus) {
          const pt = getShapeSamplePoint(cmd.shape, progress);
          if (pt) {
            stylusPosition = { x: pt[0], y: pt[1], active: true };
          }
        } else if (cmd.action === "CAMERA_ZOOM") {
          cameraViewport = cmd.targetViewport;
        }
      }
    }

    return {
      timeMs,
      durationMs: this.durationMs,
      progress: this.durationMs > 0 ? timeMs / this.durationMs : 0,
      activeCommandIds,
      completedCommandIds,
      highlightedElementIds,
      erasedElementIds,
      stylusPosition,
      cameraViewport,
    };
  }

  private startLoop() {
    if (typeof requestAnimationFrame !== "function") return;

    const frame = (now: number) => {
      if (!this.isPlaying || this.isScrubbing) return;

      if (this.audio && !this.audio.paused && !this.audio.seeking) {
        // Tightly bind to audio.currentTime
        const audioMs = Math.round(this.audio.currentTime * 1000);
        this.seekMs(audioMs);
      } else {
        if (this.lastRafTimestamp !== null) {
          const delta = now - this.lastRafTimestamp;
          this.tickManual(delta);
        }
      }
      this.lastRafTimestamp = now;

      if (this.isPlaying) {
        this.rafId = requestAnimationFrame(frame);
      }
    };

    this.rafId = requestAnimationFrame(frame);
  }

  private emit(state: EngineActiveState) {
    this.listeners.forEach((l) => l(state));
  }

  public destroy() {
    this.pause();
    this.listeners.clear();
    this.audio = null;
  }
}

function getShapeSamplePoint(shape: any, progress: number): [number, number] | null {
  if (!shape) return null;
  switch (shape.type) {
    case "line":
    case "arrow": {
      const [x1, y1] = shape.from;
      const [x2, y2] = shape.to;
      return [x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress];
    }
    case "circle": {
      const angle = progress * 2 * Math.PI;
      return [shape.x + shape.r * Math.cos(angle), shape.y + shape.r * Math.sin(angle)];
    }
    case "rect": {
      // Traverse perimeter
      const p = progress * 4;
      if (p <= 1) return [shape.x + shape.w * p, shape.y];
      if (p <= 2) return [shape.x + shape.w, shape.y + shape.h * (p - 1)];
      if (p <= 3) return [shape.x + shape.w * (3 - p), shape.y + shape.h];
      return [shape.x, shape.y + shape.h * (4 - p)];
    }
    default:
      if (typeof shape.x === "number" && typeof shape.y === "number") {
        return [shape.x, shape.y];
      }
      return null;
  }
}

