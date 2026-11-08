import { describe, expect, it } from 'vitest';
import { TabataTimer, type WorkoutConfig } from './model';

const config: WorkoutConfig = {
  workSeconds: 2,
  restSeconds: 1,
  rounds: 2,
  preparationSeconds: 1,
  cooldownSeconds: 2,
};

describe('TabataTimer', () => {
  it('moves through preparation, work, rest, cooldown, and completion', () => {
    const timer = new TabataTimer(config);
    timer.start(1000);

    expect(timer.snapshot(1999)).toMatchObject({ phase: 'preparation', remainingMs: 1 });
    expect(timer.snapshot(2000)).toMatchObject({ phase: 'work', round: 1, remainingMs: 2000 });
    expect(timer.snapshot(4000)).toMatchObject({ phase: 'rest', round: 1, remainingMs: 1000 });
    expect(timer.snapshot(5000)).toMatchObject({ phase: 'work', round: 2, remainingMs: 2000 });
    expect(timer.snapshot(7000)).toMatchObject({ phase: 'cooldown', remainingMs: 2000 });
    expect(timer.snapshot(9000)).toMatchObject({ status: 'complete', phase: 'complete' });
  });

  it('pauses with the exact remaining time and resumes from a new deadline', () => {
    const timer = new TabataTimer({
      ...config,
      workSeconds: 20,
      preparationSeconds: 0,
      cooldownSeconds: 0,
    });
    timer.start(1000);
    timer.pause(6000);

    expect(timer.snapshot(20_000)).toMatchObject({
      status: 'paused',
      phase: 'work',
      remainingMs: 15_000,
    });

    timer.resume(30_000);
    expect(timer.snapshot(44_999)).toMatchObject({ status: 'running', remainingMs: 1 });
    expect(timer.snapshot(45_000)).toMatchObject({ phase: 'rest', round: 1 });
  });

  it('resets from a paused or completed workout', () => {
    const timer = new TabataTimer({ ...config, preparationSeconds: 0, cooldownSeconds: 0 });
    timer.start(0);
    timer.pause(500);
    timer.reset();
    expect(timer.snapshot(1000)).toMatchObject({ status: 'idle', phase: 'ready', remainingMs: 2000 });

    timer.start(2000);
    expect(timer.snapshot(7000).status).toBe('complete');
    timer.reset();
    expect(timer.snapshot(8000).status).toBe('idle');
  });

  it('catches up from the deadline after a long suspension', () => {
    const timer = new TabataTimer({
      workSeconds: 1,
      restSeconds: 1,
      rounds: 2,
      preparationSeconds: 0,
      cooldownSeconds: 0,
    });
    timer.start(1000);

    expect(timer.snapshot(10_000)).toMatchObject({ status: 'complete', phase: 'complete' });
  });

  it('rejects invalid configurations and changes while active', () => {
    expect(() => new TabataTimer({ ...config, rounds: 0 })).toThrow(RangeError);

    const timer = new TabataTimer(config);
    timer.start(0);
    expect(() => timer.setConfig(config)).toThrow('cannot change');
  });
});
