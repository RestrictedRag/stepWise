// Global StepWise Playback Engine with Master-Clock Drift Correction (|drift| > 80ms) and Reversible Bi-directional Scrubbing.
import type { CompiledStepManifest, CompiledCommand, CompiledDrawCommand } from "../manifest.ts";

export interface GlobalEngineState {
  globalTimeMs: number;
  totalDurationMs: number;
  currentStepIndex: number;
  stepTimeMs: number;
  isPlaying: boolean;
  isScrubbing: boolean;
  isStalled: boolean;
  activeCommandIds: Set<string>;
  completedCommandIds: Set<string>;
  commandProgress: Map<string, number>;
  eraseProgress: Map<string, number>;
  highlightedElementIds: Map<string, { style: string; intensity: number }>;
  erasedElementIds: Set<string>;
  stepOffsets: number[];
  cameraViewport?: { x: number; y: number; width: number; height: number };
  stylusPosition?: { x: number; y: number; active: boolean };
}

export type EngineActiveState = GlobalEngineState;

export type GlobalPlaybackListener = (state: GlobalEngineState) => void;

export class GlobalPlaybackEngine {
  private steps: CompiledStepManifest[] = [];
  private stepOffsets: number[] = [];
  private totalDurationMs: number = 0;
  private currentStepIndex: number = 0;
  private globalTimeMs: number = 0;
  private isPlaying: boolean = false;
  private isScrubbing: boolean = false;
  private isStalled: boolean = false;
  private speed: number = 1.0;

  private audios: Map<number, HTMLAudioElement> = new Map();
  private rafId: number | null = null;
  private lastRafTimestamp: number | null = null;
  private listeners: Set<GlobalPlaybackListener> = new Set();
  private onStepChangedCallback?: (stepIndex: number) => void;

  constructor(initialSteps: CompiledStepManifest[] = []) {
    initialSteps.forEach((s) => this.appendStep(s));
  }

  public subscribe(listener: GlobalPlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.computeStateAt(this.globalTimeMs));
    return () => this.listeners.delete(listener);
  }

  public onStepChange(cb: (stepIndex: number) => void) {
    this.onStepChangedCallback = cb;
  }

  // Appends a new step dynamically as it arrives over the stream
  public appendStep(step: CompiledStepManifest) {
    const offset = this.totalDurationMs;
    this.steps.push(step);
    this.stepOffsets.push(offset);
    this.totalDurationMs += step.speech.durationMs;

    // If stalled waiting for this step, resume playback
    if (this.isStalled && this.isPlaying) {
      this.isStalled = false;
      this.play();
    }

    this.emit();
  }

  public bindStepAudio(stepIndex: number, audio: HTMLAudioElement) {
    audio.playbackRate = this.speed;
    this.audios.set(stepIndex, audio);
  }

  public play() {
    if (this.isPlaying && !this.isStalled) return;
    this.isPlaying = true;

    // Check if we reached end of all compiled steps
    if (this.globalTimeMs >= this.totalDurationMs) {
      this.isStalled = true;
      this.emit();
      return;
    }

    this.syncActiveAudioPlayState(true);
    this.lastRafTimestamp = null;
    this.startLoop();
    this.emit();
  }

  public pause() {
    this.isPlaying = false;
    this.syncActiveAudioPlayState(false);
    if (this.rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.emit();
  }

  // Speed changes go through audio.playbackRate ONLY
  public setSpeed(multiplier: number) {
    this.speed = Math.max(0.25, Math.min(3.0, multiplier));
    this.audios.forEach((audio) => {
      audio.playbackRate = this.speed;
    });
  }

  // Bi-directional Scrubbing
  public startScrub() {
    this.isScrubbing = true;
    this.pause();
  }

  public scrubToGlobalMs(targetMs: number) {
    this.seekGlobalMs(targetMs);
  }

  public endScrub(resumePlayback: boolean) {
    this.isScrubbing = false;
    if (resumePlayback && this.globalTimeMs < this.totalDurationMs) {
      this.play();
    } else {
      this.emit();
    }
  }

  public seekGlobalMs(targetMs: number) {
    const clamped = Math.max(0, Math.min(this.totalDurationMs, targetMs));
    this.globalTimeMs = clamped;

    const newStepIndex = this.findStepIndexForTime(clamped);
    const stepChanged = newStepIndex !== this.currentStepIndex;

    if (stepChanged) {
      // Pause previous audio
      const prevAudio = this.audios.get(this.currentStepIndex);
      if (prevAudio && !prevAudio.paused) prevAudio.pause();

      this.currentStepIndex = newStepIndex;
      this.onStepChangedCallback?.(newStepIndex);
    }

    // Seek active audio
    const activeAudio = this.audios.get(this.currentStepIndex);
    if (activeAudio) {
      const localSec = (clamped - this.stepOffsets[this.currentStepIndex]) / 1000;
      activeAudio.currentTime = Math.max(0, localSec);
    }

    this.emit();
  }

  private findStepIndexForTime(timeMs: number): number {
    for (let i = this.stepOffsets.length - 1; i >= 0; i--) {
      if (timeMs >= this.stepOffsets[i]) return i;
    }
    return 0;
  }

  private syncActiveAudioPlayState(play: boolean) {
    const activeAudio = this.audios.get(this.currentStepIndex);
    if (!activeAudio) return;

    if (play) {
      const localSec = (this.globalTimeMs - this.stepOffsets[this.currentStepIndex]) / 1000;
      if (Math.abs(activeAudio.currentTime - localSec) > 0.08) {
        activeAudio.currentTime = localSec;
      }
      activeAudio.playbackRate = this.speed;
      activeAudio.play().catch(() => {});
    } else {
      if (!activeAudio.paused) activeAudio.pause();
    }
  }

  private startLoop() {
    if (typeof requestAnimationFrame !== "function") return;

    const frame = (now: number) => {
      if (!this.isPlaying || this.isScrubbing) return;

      const activeAudio = this.audios.get(this.currentStepIndex);
      const stepOffset = this.stepOffsets[this.currentStepIndex] ?? 0;

      if (activeAudio && !activeAudio.paused && !activeAudio.seeking) {
        // Audio is master clock. Timeline runs on internal progression,
        // and gently corrects only when |drift| > 80ms.
        const audioGlobalMs = stepOffset + Math.round(activeAudio.currentTime * 1000);
        const drift = audioGlobalMs - this.globalTimeMs;

        if (Math.abs(drift) > 80) {
          // Correct clock gently
          this.globalTimeMs = audioGlobalMs;
        } else {
          // Advance smoothly with delta
          if (this.lastRafTimestamp !== null) {
            const dt = (now - this.lastRafTimestamp) * this.speed;
            this.globalTimeMs += dt;
          }
        }

        // Check if current step audio ended
        if (activeAudio.ended || activeAudio.currentTime >= activeAudio.duration) {
          this.advanceToNextStep();
        }
      } else {
        // Fallback: silent reading clock
        if (this.lastRafTimestamp !== null) {
          const dt = (now - this.lastRafTimestamp) * this.speed;
          this.globalTimeMs += dt;

          const currentStep = this.steps[this.currentStepIndex];
          if (currentStep && this.globalTimeMs >= stepOffset + currentStep.speech.durationMs) {
            this.advanceToNextStep();
          }
        }
      }

      this.lastRafTimestamp = now;

      if (this.globalTimeMs >= this.totalDurationMs) {
        // Stalled or complete
        this.globalTimeMs = this.totalDurationMs;
        this.isStalled = true;
        this.pause();
      }

      this.emit();

      if (this.isPlaying && !this.isStalled) {
        this.rafId = requestAnimationFrame(frame);
      }
    };

    this.rafId = requestAnimationFrame(frame);
  }

  private advanceToNextStep() {
    const nextIdx = this.currentStepIndex + 1;
    if (nextIdx < this.steps.length) {
      this.seekGlobalMs(this.stepOffsets[nextIdx]);
      if (this.isPlaying) {
        this.syncActiveAudioPlayState(true);
      }
    } else {
      // Stall waiting for streaming step
      this.isStalled = true;
      this.pause();
    }
  }

  public computeStateAt(globalMs: number): GlobalEngineState {
    const stepIdx = this.findStepIndexForTime(globalMs);
    const stepOffset = this.stepOffsets[stepIdx] ?? 0;
    const stepTimeMs = globalMs - stepOffset;

    const activeCommandIds = new Set<string>();
    const completedCommandIds = new Set<string>();
    const commandProgress = new Map<string, number>();
    const eraseProgress = new Map<string, number>();
    const highlightedElementIds = new Map<string, { style: string; intensity: number }>();
    const erasedElementIds = new Set<string>();

    // Evaluate all commands up to the current global time deterministically
    for (let s = 0; s <= stepIdx; s++) {
      const step = this.steps[s];
      const offset = this.stepOffsets[s];

      for (const cmd of step.commands) {
        const cmdGlobalStart = offset + cmd.startMs;
        const cmdGlobalEnd = cmdGlobalStart + cmd.durationMs;

        if (globalMs >= cmdGlobalEnd) {
          completedCommandIds.add(cmd.id);
          commandProgress.set(cmd.id, 1.0);
          if (cmd.action === "ERASE") {
            cmd.targetIds.forEach((tid) => {
              erasedElementIds.add(tid);
              eraseProgress.set(tid, 1.0);
            });
          }
        } else if (globalMs >= cmdGlobalStart) {
          activeCommandIds.add(cmd.id);
          const progress = Math.max(0, Math.min(1, (globalMs - cmdGlobalStart) / Math.max(1, cmd.durationMs)));
          commandProgress.set(cmd.id, progress);

          if (cmd.action === "HIGHLIGHT") {
            highlightedElementIds.set(cmd.targetId, {
              style: cmd.style,
              intensity: Math.sin(progress * Math.PI), // pulse arc
            });
          } else if (cmd.action === "ERASE") {
            // Reversible fade-based erase: elements fade out
            cmd.targetIds.forEach((tid) => {
              eraseProgress.set(tid, progress);
              if (progress >= 0.95) erasedElementIds.add(tid);
            });
          }
        } else {
          commandProgress.set(cmd.id, 0.0);
        }
      }
    }

    return {
      globalTimeMs: globalMs,
      totalDurationMs: this.totalDurationMs,
      currentStepIndex: stepIdx,
      stepTimeMs,
      isPlaying: this.isPlaying,
      isScrubbing: this.isScrubbing,
      isStalled: this.isStalled,
      activeCommandIds,
      completedCommandIds,
      commandProgress,
      eraseProgress,
      highlightedElementIds,
      erasedElementIds,
      stepOffsets: this.stepOffsets,
    };
  }

  private emit() {
    const state = this.computeStateAt(this.globalTimeMs);
    this.listeners.forEach((l) => l(state));
  }

  public destroy() {
    this.pause();
    this.listeners.clear();
    this.audios.clear();
  }
}

export { GlobalPlaybackEngine as StepWisePlaybackEngine };
