export const DEFAULT_WORKOUT: WorkoutConfig = {
  workSeconds: 20,
  restSeconds: 10,
  rounds: 8,
  preparationSeconds: 5,
  cooldownSeconds: 0,
};

export const WORKOUT_LIMITS = {
  workSeconds: { min: 1, max: 600 },
  restSeconds: { min: 1, max: 600 },
  rounds: { min: 1, max: 99 },
  preparationSeconds: { min: 0, max: 60 },
  cooldownSeconds: { min: 0, max: 600 },
} as const;

export interface WorkoutConfig {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  preparationSeconds: number;
  cooldownSeconds: number;
}

export type WorkoutPhase =
  | 'ready'
  | 'preparation'
  | 'work'
  | 'rest'
  | 'cooldown'
  | 'complete';

export type WorkoutStatus = 'idle' | 'running' | 'paused' | 'complete';

interface Segment {
  phase: Exclude<WorkoutPhase, 'ready' | 'complete'>;
  round: number;
  durationMs: number;
}

export interface TimerSnapshot {
  status: WorkoutStatus;
  phase: WorkoutPhase;
  round: number;
  totalRounds: number;
  remainingMs: number;
  phaseDurationMs: number;
}

type TimerState =
  | { status: 'idle' }
  | { status: 'running'; segmentIndex: number; deadlineMs: number }
  | { status: 'paused'; segmentIndex: number; remainingMs: number }
  | { status: 'complete' };

function makeSegments(config: WorkoutConfig): Segment[] {
  const segments: Segment[] = [];

  if (config.preparationSeconds > 0) {
    segments.push({
      phase: 'preparation',
      round: 1,
      durationMs: config.preparationSeconds * 1000,
    });
  }

  for (let round = 1; round <= config.rounds; round += 1) {
    segments.push({ phase: 'work', round, durationMs: config.workSeconds * 1000 });

    if (round < config.rounds) {
      segments.push({ phase: 'rest', round, durationMs: config.restSeconds * 1000 });
    }
  }

  if (config.cooldownSeconds > 0) {
    segments.push({
      phase: 'cooldown',
      round: config.rounds,
      durationMs: config.cooldownSeconds * 1000,
    });
  }

  return segments;
}

export function isWorkoutConfig(value: unknown): value is WorkoutConfig {
  if (typeof value !== 'object' || value === null) return false;

  return Object.entries(WORKOUT_LIMITS).every(([key, bounds]) => {
    const candidate = (value as Record<string, unknown>)[key];
    return (
      typeof candidate === 'number' &&
      Number.isInteger(candidate) &&
      candidate >= bounds.min &&
      candidate <= bounds.max
    );
  });
}

export class TabataTimer {
  private config: WorkoutConfig;
  private segments: Segment[];
  private state: TimerState = { status: 'idle' };

  constructor(config: WorkoutConfig) {
    if (!isWorkoutConfig(config)) throw new RangeError('Invalid workout configuration');
    this.config = { ...config };
    this.segments = makeSegments(this.config);
  }

  setConfig(config: WorkoutConfig): void {
    if (this.state.status === 'running' || this.state.status === 'paused') {
      throw new Error('Workout settings cannot change while the timer is active');
    }
    if (!isWorkoutConfig(config)) throw new RangeError('Invalid workout configuration');

    this.config = { ...config };
    this.segments = makeSegments(this.config);
    this.state = { status: 'idle' };
  }

  start(now: number): void {
    if (this.state.status === 'running' || this.state.status === 'paused') return;
    this.state = {
      status: 'running',
      segmentIndex: 0,
      deadlineMs: now + this.segments[0].durationMs,
    };
  }

  pause(now: number): void {
    this.advance(now);
    if (this.state.status !== 'running') return;

    this.state = {
      status: 'paused',
      segmentIndex: this.state.segmentIndex,
      remainingMs: Math.max(0, this.state.deadlineMs - now),
    };
  }

  resume(now: number): void {
    if (this.state.status !== 'paused') return;
    this.state = {
      status: 'running',
      segmentIndex: this.state.segmentIndex,
      deadlineMs: now + this.state.remainingMs,
    };
  }

  reset(): void {
    this.state = { status: 'idle' };
  }

  snapshot(now: number): TimerSnapshot {
    this.advance(now);

    if (this.state.status === 'complete') {
      return {
        status: 'complete',
        phase: 'complete',
        round: this.config.rounds,
        totalRounds: this.config.rounds,
        remainingMs: 0,
        phaseDurationMs: 0,
      };
    }

    if (this.state.status === 'idle') {
      const firstSegment = this.segments[0];
      return {
        status: 'idle',
        phase: 'ready',
        round: 1,
        totalRounds: this.config.rounds,
        remainingMs: firstSegment.durationMs,
        phaseDurationMs: firstSegment.durationMs,
      };
    }

    const segment = this.segments[this.state.segmentIndex];
    const remainingMs =
      this.state.status === 'paused'
        ? this.state.remainingMs
        : Math.max(0, this.state.deadlineMs - now);

    return {
      status: this.state.status,
      phase: segment.phase,
      round: segment.round,
      totalRounds: this.config.rounds,
      remainingMs,
      phaseDurationMs: segment.durationMs,
    };
  }

  private advance(now: number): void {
    if (!Number.isFinite(now)) throw new RangeError('Clock value must be finite');

    while (this.state.status === 'running' && now >= this.state.deadlineMs) {
      const nextIndex = this.state.segmentIndex + 1;

      if (nextIndex >= this.segments.length) {
        this.state = { status: 'complete' };
        return;
      }

      this.state = {
        status: 'running',
        segmentIndex: nextIndex,
        deadlineMs: this.state.deadlineMs + this.segments[nextIndex].durationMs,
      };
    }
  }
}
